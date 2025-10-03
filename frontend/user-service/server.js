require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const connectDB = require('./db');
const User = require('./models/user');

const app = express();

// Connect to MongoDB
connectDB();


app.use(cors({
    origin: 'https://mynews-frontend.netlify.app/',
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}));

app.use(express.json());

// Register
app.post('/users', async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;
    if (!email || !password || !recaptchaToken) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // ✅ Verify Google reCAPTCHA
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

    // ✅ Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // ✅ Create user
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash: hash });

    res.json({ email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Get user
app.get('/users/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    res.json(user || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`User service on ${PORT}`));
