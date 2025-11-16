require('dotenv').config({ path: './backend/.env' });
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;
console.log('Testing connection with:', connectionString.replace(/:[^:@]+@/, ':****@'));

const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 2,
  connect_timeout: 10,
});

sql`SELECT version()`
  .then((result) => {
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', result[0].version);
    sql.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Connection failed:');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    if (err.hostname) {
      console.error('Hostname:', err.hostname);
    }
    sql.end();
    process.exit(1);
  });
