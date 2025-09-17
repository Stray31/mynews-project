require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db');   // <- uses the same db.js you already have

async function addUser(email, plainPassword) {
  try {
    const hash = await bcrypt.hash(plainPassword, 10);
    await pool.query(
      'INSERT INTO users (email, passwordHash) VALUES (?, ?)',
      [email, hash]
    );
    console.log(`✅ User ${email} added.`);
  } catch (err) {
    console.error('❌ Error adding user:', err);
  } finally {
    pool.end(); // close the MySQL connection pool
  }
}

// pass email & password as command-line args
const [,, email, password] = process.argv;
if (!email || !password) {
  console.log('Usage: node addUser.js <email> <password>');
  process.exit(1);
}

addUser(email, password);