require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const connectDB = require('./db');
const crypto = require('crypto');
const session = require('express-session');
const axios = require('axios');
const svgCaptcha = require('svg-captcha');
const path = require('path');





// Import Mongoose model
const User = require('./models/user');

const app = express();

// connect to MongoDB
connectDB();


app.use(cors({
    origin: 'https://mynews-frontend.netlify.app',
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'someStrongSecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true in production with HTTPS
    sameSite: 'lax',  // allow cross-site
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));


console.log('FRONTEND_BASE =', process.env.FRONTEND_BASE);

//
// ================== REGISTER ==================
//
app.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    // check if email exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // create verification token
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = new User({
      firstName: firstName || '',
      lastName: lastName || '',
      email,
      passwordHash: hash,
      verified: false,
      verificationToken,
      verificationTokenExpires: verificationExpires
    });

    await newUser.save();

    // Build verification link
    const verifyURL = `${process.env.AUTH_BASE || 'mynews-project-production-1d2a.up.railway.app'}/verify/${verificationToken}`;

    // Call email service
    const verificationServiceUrl = process.env.EMAIL_VERIFICATION_URL || 'mynews-project-production.up.railway.app/send-verification';
    await axios.post(verificationServiceUrl, { email, verifyURL });

    return res.json({ success: true, message: 'Registered. Check your email to verify your account.' });
  } catch (err) {
    console.error('register err', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

//
// ================== LOGIN ==================
//
app.post('/login', async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  try {
    // verify recaptcha
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`;
    const response = await axios.post(verifyURL);
    if (!response.data.success) {
      return res.status(400).json({ error: 'Captcha verification failed' });
    }

    // find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('User not found');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).send('Invalid password');

    // issue JWT
    const token = jwt.sign(
      { id: user._id, firstName: user.firstName },
      process.env.JWT_SECRET || 'yoursecret',
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

//
// ================== FORGOT PASSWORD ==================
//
app.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const user = await User.findOne({ email });
    if (!user) return res.json({ sent: true }); // prevent enumeration

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    user.resetToken = token;
    user.resetExpires = expires;
    await user.save();

    const resetURL = `${process.env.FRONTEND_BASE}/reset.html?token=${token}`;
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://mynews-project-production.up.railway.app/send-reset';
    await axios.post(emailServiceUrl, { email, resetURL });

    return res.json({ sent: true });
  } catch (err) {
    console.error('Forgot error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

//
// ================== VERIFY EMAIL ==================
//
app.get('/verify/:token', async (req, res) => {
   
  try {
    
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).send('Invalid or expired verification link');

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    const frontendBase = process.env.FRONTEND_BASE || 'https://mynews-frontend.netlify.app/';
    return res.redirect(`${frontendBase}/verified.html`);
  } catch (err) {
    console.error('verify err', err);
    return res.status(500).send('Server error');
  }
});

//
// ================== RESET VALIDATION ==================
//
app.get('/reset/validate/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetToken: req.params.token,
      resetExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ valid: false });
    return res.json({ valid: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false });
  }
});

//
// ================== RESET PASSWORD ==================
//
app.post('/reset/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const user = await User.findOne({
      resetToken: req.params.token,
      resetExpires: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const hash = await bcrypt.hash(password, 10);
    user.passwordHash = hash;
    user.resetToken = undefined;
    user.resetExpires = undefined;
    await user.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

//
// ================== CAPTCHA ==================
//
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: '#ccf'
  });
  req.session.captcha = captcha.text;
  res.type('svg');
  res.status(200).send(captcha.data);
});

app.post('/verify-captcha', (req, res) => {
  const { input } = req.body;
  if (input && input.toLowerCase() === req.session.captcha?.toLowerCase()) {
    return res.json({ success: true });
  }
  return res.status(400).json({ success: false });
});

//
// ================== START SERVER ==================
//
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Auth service on ${PORT}`));
