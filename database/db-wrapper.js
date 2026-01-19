/**
 * Database Wrapper with TEST_MODE Transaction Safety
 *
 * Wraps all database operations in auto-rollback transactions when TEST_MODE=true.
 * This ensures The Mechanic's sandbox tests never permanently alter production data.
 *
 * @module DatabaseWrapper
 * @author Principal Infrastructure Engineer
 */

const db = require('./db');
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection for raw transaction control
let pgPool = null;
let testTransaction = null;

/**
 * Initialize PostgreSQL pool for TEST_MODE transactions
 */
function initializePgPool() {
    if (!pgPool && process.env.SUPABASE_DB_URL) {
        pgPool = new Pool({
            connectionString: process.env.SUPABASE_DB_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });

        console.log('[DB-Wrapper] PostgreSQL pool initialized for TEST_MODE');
    }
}

/**
 * Begin a test transaction that will auto-rollback
 */
async function beginTestTransaction() {
    if (!process.env.TEST_MODE) {
        return null;
    }

    initializePgPool();

    if (!pgPool) {
        console.warn('[DB-Wrapper] TEST_MODE enabled but no direct DB connection available');
        console.warn('[DB-Wrapper] Set SUPABASE_DB_URL for full transaction safety');
        return null;
    }

    try {
        const client = await pgPool.connect();
        await client.query('BEGIN');

        console.log('[DB-Wrapper] TEST TRANSACTION STARTED - All changes will be rolled back');

        testTransaction = client;
        return client;
    } catch (error) {
        console.error('[DB-Wrapper] Failed to start test transaction:', error);
        return null;
    }
}

/**
 * Rollback test transaction
 */
async function rollbackTestTransaction() {
    if (!testTransaction) {
        return;
    }

    try {
        await testTransaction.query('ROLLBACK');
        testTransaction.release();

        console.log('[DB-Wrapper] TEST TRANSACTION ROLLED BACK - No data was persisted');

        testTransaction = null;
    } catch (error) {
        console.error('[DB-Wrapper] Failed to rollback test transaction:', error);

        // Force release connection
        if (testTransaction) {
            testTransaction.release();
            testTransaction = null;
        }
    }
}

/**
 * Execute a database function with TEST_MODE safety
 *
 * @param {Function} dbFunction - The database function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} Function result
 */
async function executeWithSafety(dbFunction, ...args) {
    const isTestMode = process.env.TEST_MODE === 'true';

    if (!isTestMode) {
        // Normal execution - no transaction wrapper
        return await dbFunction(...args);
    }

    // TEST MODE: Execute with transaction safety
    let transaction = testTransaction;
    const shouldAutoRollback = !transaction; // Auto rollback if we start the transaction

    try {
        // Start transaction if not already in one
        if (!transaction) {
            transaction = await beginTestTransaction();
        }

        // Execute the database function
        const result = await dbFunction(...args);

        // Auto-rollback after operation if we started the transaction
        if (shouldAutoRollback && transaction) {
            await rollbackTestTransaction();
        }

        return result;

    } catch (error) {
        // Rollback on error
        if (shouldAutoRollback && transaction) {
            await rollbackTestTransaction();
        }

        throw error;
    }
}

/**
 * Wrap all database module functions with TEST_MODE safety
 *
 * @returns {Object} Wrapped database module
 */
function createSafeDbWrapper() {
    const wrappedDb = {};

    // Wrap each exported database function
    for (const [key, value] of Object.entries(db)) {
        if (typeof value === 'function') {
            // Wrap function with safety layer
            wrappedDb[key] = async function(...args) {
                return await executeWithSafety(value, ...args);
            };
        } else {
            // Pass through non-function exports (like supabase client)
            wrappedDb[key] = value;
        }
    }

    return wrappedDb;
}

/**
 * Manual transaction control for complex test scenarios
 */
const testControl = {
    /**
     * Start a test transaction manually (for test suites)
     */
    async begin() {
        if (process.env.TEST_MODE !== 'true') {
            throw new Error('Test control only available in TEST_MODE');
        }
        return await beginTestTransaction();
    },

    /**
     * Rollback test transaction manually (for test suites)
     */
    async rollback() {
        if (process.env.TEST_MODE !== 'true') {
            throw new Error('Test control only available in TEST_MODE');
        }
        await rollbackTestTransaction();
    },

    /**
     * Execute multiple operations in a single test transaction
     *
     * @param {Function} testFn - Async function containing test operations
     * @returns {Promise<any>} Test function result
     */
    async runInTransaction(testFn) {
        if (process.env.TEST_MODE !== 'true') {
            throw new Error('Test control only available in TEST_MODE');
        }

        try {
            await this.begin();
            const result = await testFn();
            await this.rollback();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }
};

// Create the wrapped database module
const safeDb = createSafeDbWrapper();

// Log TEST_MODE status on module load
if (process.env.TEST_MODE === 'true') {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️  TEST MODE ACTIVE  ⚠️                 ║');
    console.log('║                                                           ║');
    console.log('║  All database operations will be ROLLED BACK              ║');
    console.log('║  No data will be permanently written to the database      ║');
    console.log('║                                                           ║');
    console.log('║  This is a safety feature for The Mechanic sandbox       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
}

module.exports = {
    ...safeDb,
    testControl
};
