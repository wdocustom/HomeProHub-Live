const { Pool } = require('pg');
const dns = require('dns');
const { parse } = require('url');
const util = require('util');

// Promisify dns.lookup to use async/await
const lookup = util.promisify(dns.lookup);

let pool;

async function getPool() {
  if (pool) return pool;

  try {
    // 1. Parse the connection string
    const dbConfig = parse(process.env.DATABASE_URL);

    // 2. FORCE IPv4: Ask the OS specifically for an IPv4 address (Family 4)
    // This bypasses the ENETUNREACH (IPv6) and ENODATA (Bad DNS) issues.
    console.log(`[DB] Resolving IP for ${dbConfig.hostname}...`);
    const { address } = await lookup(dbConfig.hostname, { family: 4 });
    console.log(`[DB] Resolved to: ${address}`);

    // 3. Create Pool with the raw IP address
    const auth = dbConfig.auth ? dbConfig.auth.split(':') : [];
    pool = new Pool({
      user: auth[0],
      password: auth[1],
      host: address, // <--- Using the IP prevents internal DNS lookups
      port: dbConfig.port || 5432,
      database: dbConfig.pathname.split('/')[1],
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      connectionTimeoutMillis: 5000,     // Fail fast
      idleTimeoutMillis: 30000,
      max: 20
    });

    // Error handler to prevent crashing on idle connection loss
    pool.on('error', (err) => {
      console.error('[DB Pool Error]', err);
      // Don't exit, just log it. The pool will reconnect.
    });

  } catch (err) {
    console.error('[DB Config Error] Failed to resolve DB Hostname:', err);
    throw err;
  }

  return pool;
}

module.exports = {
  query: async (text, params) => {
    const p = await getPool();
    return p.query(text, params);
  },
  getPool // Export for shutdown if needed
};
