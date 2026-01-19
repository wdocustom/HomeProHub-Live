/**
 * SimpleTestTarget.js
 *
 * Simple standalone test file for sandbox demonstration
 * No external dependencies - pure JavaScript
 */

class SimpleTestTarget {
    /**
     * Add two numbers - HAS A BUG
     */
    add(a, b) {
        // BUG: Forgot to return the result!
        const result = a + b;
        // Missing: return result;
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
