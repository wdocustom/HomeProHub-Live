/**
 * The Mechanic AI - Sandbox Integration Example
 *
 * This file demonstrates how The Mechanic AI should use the Sandbox Environment
 * to safely test code patches before applying them to production.
 *
 * DO NOT EXECUTE THIS FILE DIRECTLY - It is documentation and examples only.
 *
 * @module MechanicIntegration
 * @author Principal Infrastructure Engineer
 */

const SandboxService = require('./SandboxService');
const { TestFlightRunner, CriteriaType } = require('./TestFlightRunner');

// ========================================
// EXECUTION PROTOCOL FOR THE MECHANIC AI
// ========================================

/**
 * STEP-BY-STEP WORKFLOW
 *
 * When The Mechanic wants to fix a bug:
 *
 * 1. SPIN UP SANDBOX
 *    - Call SandboxService.initialize()
 *    - Prepare test environment with patched code
 *
 * 2. APPLY FIX TO SANDBOX
 *    - Call SandboxService.prepareTestEnv(originalFile, patchedCode)
 *    - Returns sandbox session with isolated file
 *
 * 3. RUN TEST FLIGHT
 *    - Call TestFlightRunner.runTestFlight(sandboxFile, testCase)
 *    - Verify success criteria
 *
 * 4. IF SUCCESS:
 *    - Call SandboxService.promoteToProduction(sessionId)
 *    - Patched code replaces production file
 *    - Backup created automatically
 *
 * 5. IF FAIL:
 *    - Call SandboxService.cleanup(sessionId)
 *    - Alert Admin
 *    - Log failure details
 */

// ========================================
// EXAMPLE 1: Simple Bug Fix Workflow
// ========================================

async function example1_SimpleBugFix() {
    console.log('=== EXAMPLE 1: Simple Bug Fix ===\n');

    try {
        // Initialize sandbox
        await SandboxService.initialize();

        // Original file that has a bug
        const originalFile = 'services/SharkAgent.js';

        // Patched code (The Mechanic has analyzed and fixed a null reference bug)
        const patchedCode = `
// SharkAgent.js - PATCHED VERSION
const db = require('../database/db');

class SharkAgent {
    async processJob(jobId) {
        // BUG FIX: Added null check before accessing job properties
        const job = await db.getJobById(jobId);

        if (!job) {
            console.error('Job not found:', jobId);
            return { success: false, error: 'Job not found' };
        }

        // Original code would crash here if job was null
        return {
            success: true,
            jobTitle: job.title,
            status: job.status
        };
    }
}

module.exports = new SharkAgent();
        `.trim();

        // STEP 1 & 2: Prepare test environment
        const session = await SandboxService.prepareTestEnv(originalFile, patchedCode);

        console.log('Sandbox prepared:', session.sessionId);
        console.log('Sandbox file:', session.sandboxFile);

        // STEP 3: Run test flight
        const runner = new TestFlightRunner();

        const testCase = {
            name: 'Verify SharkAgent handles missing job gracefully',
            criteria: {
                type: CriteriaType.NO_ERROR,
                expected: null
            },
            timeout: 10000
        };

        const result = await runner.runTestFlight(session.sandboxFile, testCase);

        console.log('\nTest Result:', result.success ? 'PASSED ✓' : 'FAILED ✗');
        console.log('Duration:', result.duration + 'ms');
        console.log('Exit Code:', result.exitCode);

        // STEP 4 or 5: Promote or cleanup based on results
        if (result.success) {
            console.log('\n✓ Test PASSED - Promoting to production...');
            await SandboxService.promoteToProduction(session.sessionId);
            console.log('✓ Production deployment complete!');
        } else {
            console.log('\n✗ Test FAILED - Cleaning up sandbox...');
            await SandboxService.cleanup(session.sessionId);
            console.log('✗ Admin alert sent. Sandbox cleaned up.');
        }

    } catch (error) {
        console.error('Error in bug fix workflow:', error);
    }
}

// ========================================
// EXAMPLE 2: Multi-Test Verification
// ========================================

async function example2_MultipleTests() {
    console.log('=== EXAMPLE 2: Multiple Test Cases ===\n');

    try {
        await SandboxService.initialize();

        const originalFile = 'services/SharkAgent.js';
        const patchedCode = `/* patched code here */`;

        const session = await SandboxService.prepareTestEnv(originalFile, patchedCode);

        // Run multiple test cases
        const runner = new TestFlightRunner();

        const testSuite = [
            {
                name: 'Test 1: Handle null job ID',
                criteria: {
                    type: CriteriaType.NO_ERROR
                }
            },
            {
                name: 'Test 2: Process valid job successfully',
                criteria: {
                    type: CriteriaType.EXIT_CODE,
                    expected: 0
                }
            },
            {
                name: 'Test 3: Output contains success message',
                criteria: {
                    type: CriteriaType.OUTPUT_CONTAINS,
                    expected: 'success: true'
                }
            }
        ];

        const summary = await runner.runTestSuite(session.sandboxFile, testSuite);

        console.log('\nTest Suite Results:');
        console.log(`Total: ${summary.total}`);
        console.log(`Passed: ${summary.passed}`);
        console.log(`Failed: ${summary.failed}`);
        console.log(`Success Rate: ${summary.successRate.toFixed(1)}%`);

        if (summary.allPassed) {
            console.log('\n✓ All tests PASSED - Promoting to production');
            await SandboxService.promoteToProduction(session.sessionId);
        } else {
            console.log('\n✗ Some tests FAILED - Aborting deployment');
            await SandboxService.cleanup(session.sessionId);
        }

    } catch (error) {
        console.error('Error in multi-test workflow:', error);
    }
}

// ========================================
// EXAMPLE 3: Custom Verification Logic
// ========================================

async function example3_CustomVerification() {
    console.log('=== EXAMPLE 3: Custom Verification ===\n');

    try {
        await SandboxService.initialize();

        const originalFile = 'services/SharkAgent.js';
        const patchedCode = `/* patched code */`;

        const session = await SandboxService.prepareTestEnv(originalFile, patchedCode);

        const runner = new TestFlightRunner();

        // Custom verification function
        const customVerify = async (processResult) => {
            const output = processResult.output.join('');

            // Complex verification logic
            const hasSuccessMessage = output.includes('success');
            const hasNoWarnings = !output.includes('warning');
            const exitedCleanly = processResult.exitCode === 0;

            const allConditionsMet = hasSuccessMessage && hasNoWarnings && exitedCleanly;

            return {
                passed: allConditionsMet,
                message: allConditionsMet
                    ? 'All custom conditions met'
                    : `Failed conditions: success=${hasSuccessMessage}, noWarnings=${hasNoWarnings}, exitCode=${processResult.exitCode}`
            };
        };

        const testCase = {
            name: 'Custom verification test',
            criteria: {
                type: CriteriaType.CUSTOM
            },
            customVerify
        };

        const result = await runner.runTestFlight(session.sandboxFile, testCase);

        if (result.success) {
            await SandboxService.promoteToProduction(session.sessionId);
        } else {
            await SandboxService.cleanup(session.sessionId);
        }

    } catch (error) {
        console.error('Error in custom verification workflow:', error);
    }
}

// ========================================
// EXAMPLE 4: Database Safety Test
// ========================================

async function example4_DatabaseSafety() {
    console.log('=== EXAMPLE 4: Database Operation Safety ===\n');

    try {
        await SandboxService.initialize();

        // Patched code that performs database operations
        const patchedCode = `
const db = require('../../database/db-wrapper'); // Use TEST_MODE wrapper

async function testDatabaseOperation() {
    try {
        // This will run in a transaction that auto-rolls back
        const user = await db.getUserProfile('test@example.com');
        console.log('User fetched:', user);

        // This write will be rolled back automatically
        await db.updateUserProfile('test@example.com', {
            name: 'Test User MODIFIED'
        });

        console.log('TEST PASSED: Database operations executed without errors');
        process.exit(0);
    } catch (error) {
        console.error('TEST FAILED:', error);
        process.exit(1);
    }
}

testDatabaseOperation();
        `.trim();

        const session = await SandboxService.prepareTestEnv(
            'services/SharkAgent.js',
            patchedCode
        );

        const runner = new TestFlightRunner();

        const testCase = {
            name: 'Verify database operations work correctly',
            criteria: {
                type: CriteriaType.NO_ERROR
            }
        };

        // The TEST_MODE environment variable ensures all DB changes are rolled back
        const result = await runner.runTestFlight(session.sandboxFile, testCase);

        console.log('\n=== Database Safety Verification ===');
        console.log('Test Result:', result.success ? 'PASSED' : 'FAILED');
        console.log('Note: All database changes were automatically rolled back');

        if (result.success) {
            await SandboxService.promoteToProduction(session.sessionId);
        } else {
            await SandboxService.cleanup(session.sessionId);
        }

    } catch (error) {
        console.error('Error in database safety test:', error);
    }
}

// ========================================
// EXAMPLE 5: Timeout and Crash Handling
// ========================================

async function example5_TimeoutHandling() {
    console.log('=== EXAMPLE 5: Timeout and Crash Handling ===\n');

    try {
        await SandboxService.initialize();

        // Code that might hang or crash
        const patchedCode = `
async function riskyOperation() {
    // Simulate a long-running operation
    await new Promise(resolve => setTimeout(resolve, 60000)); // 60 second delay

    console.log('This should not execute if timeout works');
}

riskyOperation();
        `.trim();

        const session = await SandboxService.prepareTestEnv(
            'services/SharkAgent.js',
            patchedCode
        );

        const runner = new TestFlightRunner({ timeout: 5000 }); // 5 second timeout

        const testCase = {
            name: 'Verify timeout protection',
            criteria: {
                type: CriteriaType.NO_ERROR
            },
            timeout: 5000 // Override to 5 seconds
        };

        const result = await runner.runTestFlight(session.sandboxFile, testCase);

        console.log('\nTimeout Test Result:');
        console.log('Success:', result.success); // Should be false (timeout)
        console.log('Errors:', result.errors); // Should contain timeout error
        console.log('Duration:', result.duration + 'ms'); // Should be ~5000ms

        // Always cleanup on timeout failures
        await SandboxService.cleanup(session.sessionId);

    } catch (error) {
        console.error('Error in timeout handling test:', error);
    }
}

// ========================================
// HELPER FUNCTIONS FOR THE MECHANIC
// ========================================

/**
 * Complete automated bug fix workflow
 * This is what The Mechanic should call
 *
 * @param {string} filePath - Path to file with bug
 * @param {string} patchedCode - Fixed code
 * @param {Array<Object>} testCases - Test cases to verify fix
 * @returns {Promise<Object>} Deployment result
 */
async function mechanicAutoFix(filePath, patchedCode, testCases) {
    console.log('[Mechanic] Starting auto-fix workflow...');
    console.log('[Mechanic] Target file:', filePath);

    let session = null;

    try {
        // Initialize sandbox
        await SandboxService.initialize();

        // Prepare test environment
        session = await SandboxService.prepareTestEnv(filePath, patchedCode);
        console.log('[Mechanic] Sandbox prepared:', session.sessionId);

        // Run test suite
        const runner = new TestFlightRunner({ timeout: 30000 });
        const testResults = await runner.runTestSuite(session.sandboxFile, testCases);

        console.log('[Mechanic] Test results:', {
            passed: testResults.passed,
            failed: testResults.failed,
            successRate: testResults.successRate.toFixed(1) + '%'
        });

        // Promote to production if all tests pass
        if (testResults.allPassed) {
            console.log('[Mechanic] All tests passed - deploying to production');
            await SandboxService.promoteToProduction(session.sessionId);

            return {
                success: true,
                deployed: true,
                sessionId: session.sessionId,
                testResults
            };
        } else {
            console.log('[Mechanic] Tests failed - aborting deployment');
            await SandboxService.cleanup(session.sessionId);

            return {
                success: false,
                deployed: false,
                sessionId: session.sessionId,
                testResults,
                failedTests: testResults.results.filter(r => !r.success)
            };
        }

    } catch (error) {
        console.error('[Mechanic] Auto-fix workflow failed:', error);

        // Cleanup on error
        if (session) {
            await SandboxService.cleanup(session.sessionId);
        }

        return {
            success: false,
            deployed: false,
            error: error.message
        };
    }
}

/**
 * Alert admin about failed fix attempt
 *
 * @param {Object} result - Failed deployment result
 */
async function alertAdmin(result) {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              🚨 MECHANIC AUTO-FIX FAILED 🚨                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Session ID:', result.sessionId || 'N/A');
    console.log('Error:', result.error || 'Tests failed');
    console.log('');

    if (result.failedTests) {
        console.log('Failed Tests:');
        result.failedTests.forEach((test, idx) => {
            console.log(`  ${idx + 1}. ${test.testName}`);
            console.log(`     ${test.criteriaResult.message}`);
        });
    }

    console.log('');
    console.log('Action Required: Manual intervention needed');
    console.log('');

    // TODO: Send notification to admin
    // await sendAdminNotification(result);
}

// ========================================
// EXPORT FOR USE BY THE MECHANIC
// ========================================

module.exports = {
    // Main workflow function
    mechanicAutoFix,
    alertAdmin,

    // Individual examples (for reference)
    example1_SimpleBugFix,
    example2_MultipleTests,
    example3_CustomVerification,
    example4_DatabaseSafety,
    example5_TimeoutHandling
};

// ========================================
// USAGE DOCUMENTATION
// ========================================

/*

THE MECHANIC AI - QUICK START GUIDE

1. DETECT A BUG
   - Monitor error logs
   - Analyze stack traces
   - Identify problematic file

2. GENERATE A FIX
   - Analyze the code
   - Create patched version
   - Ensure imports are correct

3. CREATE TEST CASES
   const testCases = [
       TestFlightRunner.createTestCase(
           'Verify fix works',
           CriteriaType.NO_ERROR
       ),
       TestFlightRunner.createTestCase(
           'Check exit code',
           CriteriaType.EXIT_CODE,
           0
       )
   ];

4. DEPLOY THE FIX
   const result = await mechanicAutoFix(
       'services/SharkAgent.js',
       patchedCode,
       testCases
   );

   if (!result.success) {
       await alertAdmin(result);
   }

5. MONITOR RESULTS
   - Check production logs
   - Verify bug is resolved
   - Update knowledge base

BEST PRACTICES:

✓ Always include multiple test cases
✓ Use realistic timeout values (10-30 seconds)
✓ Test both success and failure scenarios
✓ Verify database operations don't persist test data
✓ Clean up sandboxes even on success (automatic)
✓ Alert admins on any failures
✓ Create backups before production deployment (automatic)
✓ Log all activities for audit trail

SAFETY GUARANTEES:

✓ Sandbox isolation - patches run in separate directory
✓ Import rewriting - relative paths automatically adjusted
✓ Database rollback - TEST_MODE auto-rolls back all changes
✓ Timeout protection - runaway processes killed automatically
✓ Automatic backup - production files backed up before overwrite
✓ Child process isolation - crashes don't affect main process
✓ Memory limits - prevents memory exhaustion
✓ Exit code verification - ensures clean process termination

*/
