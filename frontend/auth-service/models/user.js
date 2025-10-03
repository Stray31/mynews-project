const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  passwordHash: String,
  verified: { type: Boolean, default: false },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetToken: String,
  resetExpires: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
