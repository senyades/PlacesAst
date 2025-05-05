const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_ebhfW0JGdU2C@ep-weathered-frost-a40trd22-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;