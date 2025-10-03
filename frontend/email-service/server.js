require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
app.use(cors({
    origin: 'https://mynews-frontend.netlify.app',
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}));

app.use(express.json());

// configure transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/send-reset', async (req, res) => {
  try {
    const { email, resetURL } = req.body;
    if (!email || !resetURL) return res.status(400).json({ error: 'Missing email or resetURL' });

    const mailOptions = {
      from: `"NewsMail" <${process.env.EMAIL_USER}>`, // <-- custom sender name
      to: email,
      subject: 'Reset your MyNews password',
      html: `
        <p>Hello,</p>
        <p>We received a request to reset the password for your account. Click the button below to set a new password. This link will expire in 1 hour.</p>
        <p><a href="${resetURL}" style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">Reset password</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
        <p>— NewsMail</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Reset email sent:', info.messageId);
    return res.json({ success: true });
  } catch (err) {
    console.error('send-reset error:', err);
    return res.status(500).json({ error: 'email_failed' });
  }
});

app.post('/send-verification', async (req, res) => {
  try {
    const { email, verifyURL } = req.body;
    if (!email || !verifyURL) return res.status(400).json({ error: 'Missing fields' });

    const mailOptions = {
      from: `"NewsMail" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your MyNews account',
      html: `
        <p>Hello,</p>
        <p>Thanks for signing up. Click the button below to verify your email address (link valid for 24 hours):</p>
        <p>
          <a href="${verifyURL}" style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">
            Verify your email
          </a>
        </p>
        <p>If you didn't sign up, you can ignore this message.</p>
        <p>— NewsMail</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return res.json({ success: true });
  } catch (err) {
    console.error('send-verification error:', err);
    return res.status(500).json({ error: 'email_failed' });
  }
});


const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Email service on ${PORT}`));