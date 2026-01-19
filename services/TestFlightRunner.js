/**
 * TestFlightRunner.js
 *
 * Executes sandboxed code in isolated child processes with safety harness.
 * Provides verification logic and timeout protection for The Mechanic AI.
 *
 * @module TestFlightRunner
 * @author Principal Infrastructure Engineer
 */

const { fork } = require('child_process');
const path = require('path');

/**
 * Success criteria types that can be verified
 */
const CriteriaType = {
    NO_ERROR: 'NO_ERROR',                   // Process exits without errors
    FUNCTION_RETURNS: 'FUNCTION_RETURNS',   // Specific return value expected
    OUTPUT_CONTAINS: 'OUTPUT_CONTAINS',     // stdout contains specific text
    EXIT_CODE: 'EXIT_CODE',                 // Specific exit code expected
    CUSTOM: 'CUSTOM'                        // Custom verification function
};

class TestFlightRunner {
    constructor(options = {}) {
        this.defaultTimeout = options.timeout || 30000; // 30 seconds default
        this.maxMemory = options.maxMemory || 512; // MB
        this.activeTests = new Map();
    }

    /**
     * Run a test flight with sandboxed code
     *
     * @param {string} sandboxFile - Path to the sandboxed file to execute
     * @param {Object} testCase - Test configuration
     * @param {string} testCase.name - Test name/description
     * @param {Object} testCase.criteria - Success criteria
     * @param {string} testCase.criteria.type - Type from CriteriaType
     * @param {*} testCase.criteria.expected - Expected value/pattern
     * @param {number} testCase.timeout - Optional timeout override (ms)
     * @param {Object} testCase.args - Optional arguments to pass to the module
     * @param {Function} testCase.customVerify - Optional custom verification function
     * @returns {Promise<Object>} Test results
     */
    async runTestFlight(sandboxFile, testCase) {
        const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timeout = testCase.timeout || this.defaultTimeout;

        console.log(`[TestFlight:${testId}] Starting test flight:
  File: ${sandboxFile}
  Test: ${testCase.name}
  Criteria: ${testCase.criteria.type}
  Timeout: ${timeout}ms`);

        const result = {
            testId,
            testName: testCase.name,
            sandboxFile,
            success: false,
            exitCode: null,
            output: [],
            errors: [],
            duration: 0,
            criteriaResult: null,
            timestamp: new Date()
        };

        const startTime = Date.now();

        try {
            // Execute the sandbox file in a child process
            const processResult = await this._executeInChildProcess(
                sandboxFile,
                testCase.args || {},
                timeout
            );

            result.exitCode = processResult.exitCode;
            result.output = processResult.output;
            result.errors = processResult.errors;
            result.duration = Date.now() - startTime;

            // Verify success criteria
            const criteriaResult = await this._verifyCriteria(
                testCase.criteria,
                processResult,
                testCase.customVerify
            );

            result.criteriaResult = criteriaResult;
            result.success = criteriaResult.passed;

            console.log(`[TestFlight:${testId}] Test ${result.success ? 'PASSED' : 'FAILED'}:
  Duration: ${result.duration}ms
  Exit Code: ${result.exitCode}
  Criteria: ${criteriaResult.message}`);

        } catch (error) {
            result.duration = Date.now() - startTime;
            result.errors.push(error.message);
            result.success = false;
            result.criteriaResult = {
                passed: false,
                message: `Test execution failed: ${error.message}`
            };

            console.error(`[TestFlight:${testId}] Test CRASHED:`, error);
        }

        return result;
    }

    /**
     * Execute a file in a child process with TEST_MODE enabled
     *
     * @param {string} filePath - Path to file to execute
     * @param {Object} args - Arguments to pass
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} Execution results
     */
    _executeInChildProcess(filePath, args, timeout) {
        return new Promise((resolve, reject) => {
            const output = [];
            const errors = [];

            // Fork the process with TEST_MODE environment variable
            const child = fork(filePath, [], {
                env: {
                    ...process.env,
                    TEST_MODE: 'true',
                    TEST_ARGS: JSON.stringify(args)
                },
                silent: true, // Capture stdout/stderr
                execArgv: [`--max-old-space-size=${this.maxMemory}`]
            });

            let timeoutHandle;
            let resolved = false;

            // Capture stdout
            child.stdout.on('data', (data) => {
                output.push(data.toString());
            });

            // Capture stderr
            child.stderr.on('data', (data) => {
                errors.push(data.toString());
            });

            // Handle process exit
            child.on('exit', (code, signal) => {
                if (resolved) return;
                resolved = true;

                clearTimeout(timeoutHandle);

                resolve({
                    exitCode: code,
                    signal,
                    output,
                    errors
                });
            });

            // Handle process errors
            child.on('error', (error) => {
                if (resolved) return;
                resolved = true;

                clearTimeout(timeoutHandle);

                reject(new Error(`Child process error: ${error.message}`));
            });

            // Set timeout
            timeoutHandle = setTimeout(() => {
                if (resolved) return;
                resolved = true;

                child.kill('SIGTERM');

                // Force kill if still running after 2 seconds
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 2000);

                reject(new Error(`Test timeout after ${timeout}ms`));
            }, timeout);

            // Send test arguments to the child process
            child.send({ type: 'TEST_INIT', args });
        });
    }

    /**
     * Verify success criteria
     *
     * @param {Object} criteria - Criteria to verify
     * @param {Object} processResult - Process execution results
     * @param {Function} customVerify - Optional custom verification function
     * @returns {Object} Verification result
     */
    async _verifyCriteria(criteria, processResult, customVerify) {
        const { type, expected } = criteria;

        switch (type) {
            case CriteriaType.NO_ERROR:
                return {
                    passed: processResult.exitCode === 0 && processResult.errors.length === 0,
                    message: processResult.exitCode === 0
                        ? 'Process exited successfully with no errors'
                        : `Process exited with code ${processResult.exitCode}`
                };

            case CriteriaType.EXIT_CODE:
                return {
                    passed: processResult.exitCode === expected,
                    message: processResult.exitCode === expected
                        ? `Exit code matched: ${expected}`
                        : `Exit code ${processResult.exitCode} did not match expected ${expected}`
                };

            case CriteriaType.OUTPUT_CONTAINS:
                const outputText = processResult.output.join('');
                const contains = outputText.includes(expected);
                return {
                    passed: contains,
                    message: contains
                        ? `Output contains expected text: "${expected}"`
                        : `Output does not contain: "${expected}"`
                };

            case CriteriaType.FUNCTION_RETURNS:
                // For function return verification, the child process must send the result
                const lastOutput = processResult.output[processResult.output.length - 1] || '';
                try {
                    const result = JSON.parse(lastOutput);
                    const matches = JSON.stringify(result) === JSON.stringify(expected);
                    return {
                        passed: matches,
                        message: matches
                            ? `Function returned expected value`
                            : `Function returned ${JSON.stringify(result)}, expected ${JSON.stringify(expected)}`
                    };
                } catch (e) {
                    return {
                        passed: false,
                        message: `Could not parse function return value: ${lastOutput}`
                    };
                }

            case CriteriaType.CUSTOM:
                if (typeof customVerify === 'function') {
                    try {
                        const result = await customVerify(processResult);
                        return {
                            passed: result.passed || false,
                            message: result.message || 'Custom verification completed'
                        };
                    } catch (error) {
                        return {
                            passed: false,
                            message: `Custom verification failed: ${error.message}`
                        };
                    }
                }
                return {
                    passed: false,
                    message: 'Custom verification function not provided'
                };

            default:
                return {
                    passed: false,
                    message: `Unknown criteria type: ${type}`
                };
        }
    }

    /**
     * Run multiple test flights in sequence
     *
     * @param {string} sandboxFile - Sandbox file to test
     * @param {Array<Object>} testCases - Array of test cases
     * @returns {Promise<Object>} Summary of all test results
     */
    async runTestSuite(sandboxFile, testCases) {
        console.log(`[TestFlightRunner] Running test suite with ${testCases.length} tests`);

        const results = [];
        let passed = 0;
        let failed = 0;

        for (const testCase of testCases) {
            const result = await this.runTestFlight(sandboxFile, testCase);
            results.push(result);

            if (result.success) {
                passed++;
            } else {
                failed++;
            }
        }

        const summary = {
            total: testCases.length,
            passed,
            failed,
            successRate: (passed / testCases.length) * 100,
            results,
            allPassed: failed === 0
        };

        console.log(`[TestFlightRunner] Test suite complete:
  Total: ${summary.total}
  Passed: ${summary.passed}
  Failed: ${summary.failed}
  Success Rate: ${summary.successRate.toFixed(1)}%`);

        return summary;
    }

    /**
     * Create a simple test case helper
     *
     * @param {string} name - Test name
     * @param {string} criteriaType - Type from CriteriaType
     * @param {*} expected - Expected value
     * @returns {Object} Test case object
     */
    static createTestCase(name, criteriaType, expected = null) {
        return {
            name,
            criteria: {
                type: criteriaType,
                expected
            }
        };
    }
}

// Export both the class and criteria types
module.exports = {
    TestFlightRunner,
    CriteriaType
};
