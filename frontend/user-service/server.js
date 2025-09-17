require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Register
app.post('/users', async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (email, passwordHash) VALUES (?, ?)', [email, hash]);
  res.json({ email });
});

// Get user
app.get('/users/:email', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.params.email]);
  res.json(rows[0] || null);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`User service on ${PORT}`));
