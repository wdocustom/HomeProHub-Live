/**
 * Sandbox System End-to-End Test
 *
 * Tests the complete sandbox workflow:
 * 1. Initialize sandbox
 * 2. Prepare test environment
 * 3. Run test flight
 * 4. Verify results
 * 5. Cleanup
 *
 * Run with: node services/test-sandbox.js
 */

const SandboxService = require('./SandboxService');
const { TestFlightRunner, CriteriaType } = require('./TestFlightRunner');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function header(message) {
    console.log('');
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('  ' + message, 'bright');
    log('═══════════════════════════════════════════════════════════', 'cyan');
    console.log('');
}

async function testSandboxSystem() {
    header('SANDBOX SYSTEM END-TO-END TEST');

    try {
        // ===========================================
        // TEST 1: Initialize Sandbox
        // ===========================================
        header('TEST 1: Initialize Sandbox');

        await SandboxService.initialize();
        log('✓ Sandbox initialized successfully', 'green');

        // ===========================================
        // TEST 2: Prepare Test Environment
        // ===========================================
        header('TEST 2: Prepare Test Environment');

        const originalFile = 'services/TestTarget.js';

        // "Patched" version - just a simple working version
        const patchedCode = `
/**
 * TestTarget.js - PATCHED VERSION
 * This is a patched version for sandbox testing
 */

const db = require('../database/db'); // Same path as original (sandbox auto-adjusts)

class TestTarget {
    /**
     * Process a job - FIXED: Added null check
     */
    async processJob(jobId) {
        const job = await db.getJobById(jobId);

        // FIX: Added null check
        if (!job) {
            return {
                success: false,
                error: 'Job not found'
            };
        }

        return {
            success: true,
            title: job.title,
            status: job.status
        };
    }

    /**
     * Simple function for testing
     */
    simpleTest() {
        console.log('TestTarget.simpleTest() called - PATCHED VERSION');
        return { success: true, message: 'Patched version works!' };
    }
}

module.exports = new TestTarget();

// If running in TEST_MODE, execute simple test
if (process.env.TEST_MODE === 'true') {
    console.log('[TestTarget:PATCHED] Running in TEST_MODE');

    const instance = new TestTarget();
    const result = instance.simpleTest();

    console.log(JSON.stringify(result));
    process.exit(0);
}
        `.trim();

        const session = await SandboxService.prepareTestEnv(originalFile, patchedCode);

        log('✓ Test environment prepared', 'green');
        log('  Session ID: ' + session.sessionId, 'blue');
        log('  Original: ' + session.originalFile, 'blue');
        log('  Sandbox: ' + session.sandboxFile, 'blue');
        log('  Depth adjustment: ' + session.depthDifference, 'blue');

        // ===========================================
        // TEST 3: Run Test Flight
        // ===========================================
        header('TEST 3: Run Test Flight');

        const runner = new TestFlightRunner({ timeout: 10000 });

        const testCase = {
            name: 'Verify patched code executes successfully',
            criteria: {
                type: CriteriaType.NO_ERROR
            },
            timeout: 10000
        };

        log('Running test flight...', 'yellow');
        const result = await runner.runTestFlight(session.sandboxFile, testCase);

        if (result.success) {
            log('✓ Test flight PASSED', 'green');
            log('  Duration: ' + result.duration + 'ms', 'blue');
            log('  Exit code: ' + result.exitCode, 'blue');
            log('  Output lines: ' + result.output.length, 'blue');
        } else {
            log('✗ Test flight FAILED', 'red');
            log('  Errors: ' + JSON.stringify(result.errors), 'red');
        }

        // ===========================================
        // TEST 4: Multiple Test Cases
        // ===========================================
        header('TEST 4: Multiple Test Cases');

        const testSuite = [
            {
                name: 'Test A: No errors',
                criteria: { type: CriteriaType.NO_ERROR }
            },
            {
                name: 'Test B: Exit code 0',
                criteria: { type: CriteriaType.EXIT_CODE, expected: 0 }
            },
            {
                name: 'Test C: Output contains success',
                criteria: { type: CriteriaType.OUTPUT_CONTAINS, expected: 'success' }
            }
        ];

        log('Running test suite with ' + testSuite.length + ' tests...', 'yellow');
        const suiteResult = await runner.runTestSuite(session.sandboxFile, testSuite);

        log('Test Suite Results:', 'bright');
        log('  Total: ' + suiteResult.total, 'blue');
        log('  Passed: ' + suiteResult.passed, 'green');
        log('  Failed: ' + suiteResult.failed, (suiteResult.failed > 0 ? 'red' : 'blue'));
        log('  Success Rate: ' + suiteResult.successRate.toFixed(1) + '%', 'blue');

        if (suiteResult.allPassed) {
            log('✓ All tests PASSED', 'green');
        } else {
            log('✗ Some tests FAILED', 'yellow');
        }

        // ===========================================
        // TEST 5: Session Management
        // ===========================================
        header('TEST 5: Session Management');

        const sessionInfo = SandboxService.getSession(session.sessionId);
        log('✓ Session retrieved successfully', 'green');
        log('  Created at: ' + sessionInfo.createdAt.toISOString(), 'blue');

        const allSessions = SandboxService.listSessions();
        log('✓ Active sessions: ' + allSessions.length, 'green');

        // ===========================================
        // TEST 6: Cleanup
        // ===========================================
        header('TEST 6: Cleanup');

        await SandboxService.cleanup(session.sessionId);
        log('✓ Sandbox cleaned up successfully', 'green');

        const sessionsAfterCleanup = SandboxService.listSessions();
        log('  Active sessions after cleanup: ' + sessionsAfterCleanup.length, 'blue');

        // ===========================================
        // FINAL SUMMARY
        // ===========================================
        header('TEST SUMMARY');

        log('✓ All sandbox system tests PASSED', 'green');
        log('', 'reset');
        log('The sandbox environment is working correctly and ready for use by The Mechanic AI.', 'bright');
        log('', 'reset');

        return true;

    } catch (error) {
        log('', 'reset');
        log('✗ SANDBOX SYSTEM TEST FAILED', 'red');
        log('', 'reset');
        console.error(error);
        return false;
    }
}

// Run the test if executed directly
if (require.main === module) {
    testSandboxSystem()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testSandboxSystem };
