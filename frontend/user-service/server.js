require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');      // NEW
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Register
app.post('/users', async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;
    if (!email || !password || !recaptchaToken) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // ✅ 1. Verify Google reCAPTCHA
    const secret = process.env.RECAPTCHA_SECRET;
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify`;
    const verifyRes = await fetch(verifyURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${recaptchaToken}`
    });
    const google = await verifyRes.json();
    if (!google.success) {
      return res.status(400).json({ error: 'Failed reCAPTCHA validation' });
    }

    // ✅ 2. Create user if captcha passed
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (email, passwordHash) VALUES (?, ?)',
      [email, hash]
    );
    res.json({ email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get user
app.get('/users/:email', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [req.params.email]);
  res.json(rows[0] || null);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`User service on ${PORT}`));
