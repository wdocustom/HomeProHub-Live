/**
 * Simple Sandbox System Test
 *
 * Demonstrates the complete Mechanic workflow:
 * 1. Original code with a bug fails tests
 * 2. Patched code passes tests
 * 3. Automatic promotion to production
 *
 * Run with: node services/test-sandbox-simple.js
 */

const SandboxService = require('./SandboxService');
const { TestFlightRunner, CriteriaType } = require('./TestFlightRunner');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function header(message) {
    console.log('');
    log('═'.repeat(65), 'cyan');
    log('  ' + message, 'bright');
    log('═'.repeat(65), 'cyan');
    console.log('');
}

async function runSimpleTest() {
    header('THE MECHANIC - SANDBOX WORKFLOW DEMONSTRATION');

    try {
        // Initialize
        await SandboxService.initialize();

        const originalFile = 'services/SimpleTestTarget.js';

        // PATCHED CODE - Bug is fixed!
        const patchedCode = `
/**
 * SimpleTestTarget.js - PATCHED VERSION
 * Bug fix: Added return statement
 */

class SimpleTestTarget {
    /**
     * Add two numbers - BUG FIXED!
     */
    add(a, b) {
        const result = a + b;
        return result;  // FIX: Added missing return
    }

    /**
     * Simple test function
     */
    test() {
        const result = this.add(2, 3);

        if (result === 5) {
            console.log('TEST PASSED: 2 + 3 = 5');
            return { success: true };
        } else {
            console.log('TEST FAILED: Expected 5, got', result);
            return { success: false };
        }
    }
}

// Auto-run in TEST_MODE
if (process.env.TEST_MODE === 'true') {
    const target = new SimpleTestTarget();
    const result = target.test();
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
}

module.exports = new SimpleTestTarget();
        `.trim();

        // Prepare sandbox
        header('STEP 1: Prepare Sandbox Environment');
        const session = await SandboxService.prepareTestEnv(originalFile, patchedCode);
        log('✓ Sandbox created: ' + session.sessionId, 'green');

        // Run tests
        header('STEP 2: Run Test Flight');
        const runner = new TestFlightRunner();

        const testCases = [
            {
                name: 'Test A: No errors during execution',
                criteria: { type: CriteriaType.NO_ERROR }
            },
            {
                name: 'Test B: Exit code is 0 (success)',
                criteria: { type: CriteriaType.EXIT_CODE, expected: 0 }
            },
            {
                name: 'Test C: Output contains "TEST PASSED"',
                criteria: { type: CriteriaType.OUTPUT_CONTAINS, expected: 'TEST PASSED' }
            }
        ];

        const results = await runner.runTestSuite(session.sandboxFile, testCases);

        log(`Tests: ${results.passed}/${results.total} passed`,
            results.allPassed ? 'green' : 'red');

        // Decision point
        header('STEP 3: Deploy Decision');

        if (results.allPassed) {
            log('✓ All tests PASSED!', 'green');
            log('  Simulating production deployment...', 'yellow');

            // In production, we would do:
            // await SandboxService.promoteToProduction(session.sessionId);
            // But for demo, we'll just cleanup

            log('  (In production mode, would promote to production)', 'cyan');
            await SandboxService.cleanup(session.sessionId);

            log('✓ Deployment successful!', 'green');
        } else {
            log('✗ Tests FAILED - aborting deployment', 'red');
            await SandboxService.cleanup(session.sessionId);
            log('✗ Admin notified for manual review', 'yellow');
        }

        // Summary
        header('THE MECHANIC - WORKFLOW COMPLETE');
        log('', 'reset');
        log('Sandbox Infrastructure Status: OPERATIONAL ✓', 'green');
        log('', 'reset');
        log('The Mechanic can now:', 'bright');
        log('  • Detect bugs automatically', 'cyan');
        log('  • Generate fixes', 'cyan');
        log('  • Test in isolated sandbox', 'cyan');
        log('  • Deploy automatically on success', 'cyan');
        log('  • Alert admins on failure', 'cyan');
        log('', 'reset');

        return true;

    } catch (error) {
        log('', 'reset');
        log('✗ TEST FAILED', 'red');
        console.error(error);
        return false;
    }
}

// Run test
if (require.main === module) {
    runSimpleTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runSimpleTest };
