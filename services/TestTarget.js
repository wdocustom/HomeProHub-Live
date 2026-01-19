/**
 * TestTarget.js
 *
 * Simple test file to demonstrate sandbox functionality
 * This file intentionally has a bug that The Mechanic can fix
 */

const db = require('../database/db');

class TestTarget {
    /**
     * Process a job - HAS A BUG: Missing null check
     */
    async processJob(jobId) {
        const job = await db.getJobById(jobId);

        // BUG: No null check - will crash if job doesn't exist
        return {
            success: true,
            title: job.title,  // This will throw if job is null
            status: job.status
        };
    }

    /**
     * Simple function for testing
     */
    simpleTest() {
        console.log('TestTarget.simpleTest() called');
        return { success: true, message: 'Test passed' };
    }
}

module.exports = new TestTarget();

// If running in TEST_MODE, execute simple test
if (process.env.TEST_MODE === 'true') {
    console.log('[TestTarget] Running in TEST_MODE');

    const instance = new TestTarget();
    const result = instance.simpleTest();

    console.log(JSON.stringify(result));
    process.exit(0);
}
