require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const crypto = require('crypto');
const session = require('express-session');




const app = express();
app.use(cors(
  {
    origin: 'http://127.0.0.1:5500',   // your frontend origin
    credentials: true
  }
));
app.use(express.json());

app.use(session({
  secret: 'someStrongSecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // true only if using HTTPS
}));     // new


console.log('FRONTEND_BASE =', process.env.FRONTEND_BASE);

// Register (creates user with verified = 0, sends verification email)
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    // make sure email not used
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(400).json({ error: 'Email already in use' });

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // create verification token (valid 24 hours)
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // insert user with verified = 0
    await pool.query(
      'INSERT INTO users (firstName, lastName, email, passwordHash, verified, verificationToken, verificationTokenExpires) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [firstName || '', lastName || '', email, hash, verificationToken, verificationExpires]
    );

    // Build verification link that points to auth service endpoint /verify/:token
    const authBase = process.env.AUTH_BASE || 'http://localhost:5001';
    const verifyURL = `${authBase}/verify/${verificationToken}`;

    // Call email service to send verification email
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5002/send-verification';
    await axios.post(emailServiceUrl, { email, verifyURL });

    return res.json({ success: true, message: 'Registered. Check your email to verify your account.' });
  } catch (err) {
    console.error('register err', err);
    return res.status(500).json({ error: 'server_error' });
  }
});



app.post('/login', async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  const secret = process.env.RECAPTCHA_SECRET;
  const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${recaptchaToken}`;

  try {
    const response = await axios.post(verifyURL);
    if (!response.data.success) {
      return res.status(400).json({ error: 'Captcha verification failed' });
    }
  } catch (err) {
    console.error('Captcha verify error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
  
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) return res.status(400).send('User not found');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(400).send('Invalid password');

  // include firstName in JWT payload
  const token = jwt.sign(
    { id: user.id, firstName: user.firstName },   // add firstName here
    'yoursecret',
    { expiresIn: '1h' }
  );

  // return token AND user info to frontend
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName // optional
    }
  });
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
    const resetURL = `${process.env.FRONTEND_BASE || 'http://127.0.0.1:5500'}/reset.html?token=${token}`;

    // call email service to send the link
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:5002/send-reset';
    await axios.post(emailServiceUrl, { email, resetURL });

    return res.json({ sent: true });
  } catch (err) {
    console.error('Forgot error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Verification link the user clicks from email
app.get('/verify/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE verificationToken = ? AND verificationTokenExpires > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).send('Invalid or expired verification link');

    const userId = rows[0].id;
    await pool.query('UPDATE users SET verified = 1, verificationToken = NULL, verificationTokenExpires = NULL WHERE id = ?', [userId]);

    // Redirect the user to a frontend confirmation page
    const frontendBase = process.env.FRONTEND_BASE || 'http://127.0.0.1:5500';
    return res.redirect(`${frontendBase}/verified.html`);
  } catch (err) {
    console.error('verify err', err);
    return res.status(500).send('Server error');
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

const svgCaptcha = require('svg-captcha');

// Send captcha image
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,          // number of characters
    noise: 3,         // squiggly lines
    color: true,
    background: '#ccf'
  });
  req.session.captcha = captcha.text;    // store answer in session
  res.type('svg');
  res.status(200).send(captcha.data);
});

// Verify captcha input
app.post('/verify-captcha', (req, res) => {
  const { input } = req.body;
  if (input && input.toLowerCase() === req.session.captcha?.toLowerCase()) {
    return res.json({ success: true });
  }
  return res.status(400).json({ success: false });
});


app.listen(PORT, () => console.log(`Auth service on ${PORT}`));
