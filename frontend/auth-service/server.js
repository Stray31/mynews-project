require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const crypto = require('crypto');      // new
      
 

const app = express();
app.use(cors());
app.use(express.json());

console.log('FRONTEND_BASE =', process.env.FRONTEND_BASE);

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    // check if user already exists
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(400).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, passwordHash) VALUES (?, ?)', [email, hash]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(400).send('User not found');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(400).send('Invalid password');

  const token = jwt.sign({ id: user.id }, 'yoursecret');
  res.json({ token });
});

const PORT = process.env.PORT || 5001;

const axios = require('axios'); // add at the top if not already

// Forgot-password route
// FORGOT: generate token, store it, then tell email-service to send the reset link
app.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // find user (do NOT reveal whether user exists in response)
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) {
      // respond same way even if user doesn't exist (prevents email enumeration)
      return res.json({ sent: true });
    }

    const userId = rows[0].id;
    // generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // store token and expiry in DB
    await pool.query('UPDATE users SET resetToken = ?, resetExpires = ? WHERE id = ?', [token, expires, userId]);

    // build reset URL (use the URL you serve frontend on; Live Server often uses 5500)
    const resetURL = `${process.env.FRONTEND_BASE || 'http://127.0.0.1:5500'}/frontend/reset.html?token=${token}`;

    // call email service to send the link
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5002/send-reset';
    await axios.post(emailServiceUrl, { email, resetURL });

    return res.json({ sent: true });
  } catch (err) {
    console.error('Forgot error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Optional: endpoint to check token validity (used if you want client-side validation)
app.get('/reset/validate/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const [rows] = await pool.query('SELECT id FROM users WHERE resetToken = ? AND resetExpires > NOW()', [token]);
    if (!rows.length) return res.status(400).json({ valid: false });
    return res.json({ valid: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false });
  }
});

// POST to actually reset the password using token
app.post('/reset/:token', async (req, res) => {
console.log('--- /reset route hit ---');
console.log('req.params:', req.params);
console.log('req.body:', req.body); 
  try {
    const token = req.params.token;
    const { password } = req.body;

    console.log('Incoming token:', req.params.token);
    console.log('Incoming password:', req.body.password);


    if (!password) return res.status(400).json({ error: 'Missing password' });

    // find user with valid (non-expired) token
    const [rows] = await pool.query('SELECT id FROM users WHERE resetToken = ? AND resetExpires > NOW()', [token]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired token' });

    const userId = rows[0].id;
    const hash = await bcrypt.hash(password, 10);

    // update password and clear token fields
    await pool.query('UPDATE users SET passwordHash = ?, resetToken = NULL, resetExpires = NULL WHERE id = ?', [hash, userId]);

    return res.json({ success: true });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => console.log(`Auth service on ${PORT}`));
