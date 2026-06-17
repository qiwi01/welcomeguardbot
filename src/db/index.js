const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_URL?.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Auto-run schema on startup
const initDB = async () => {
  const fs = require('fs');
  const path = require('path');
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Database schema initialized');
  } catch (err) {
    if (err.code !== '42P07') { // ignore "already exists" errors
      console.error('❌ Schema init error:', err.message);
    }
  }
};

module.exports = { pool, initDB };