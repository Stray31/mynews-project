require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
app.use(cors());
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

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Email service on ${PORT}`));