require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: String,
  passwordHash: String
});

const User = mongoose.model('User', UserSchema, 'users');

async function manageUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // --- OPTIONAL: Delete all users ---
    // await User.deleteMany({});
    // console.log("All users deleted");

    // --- Add new users ---
    const usersToAdd = [
      { email: 'testuser@example.com', password: 'mypassword' },
      { email: 'user@gmail.com', password: 'secret123' }, // new user
      // add more here if you want
    ];

    for (const u of usersToAdd) {
      // Check if user already exists
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`User already exists: ${u.email}`);
        continue;
      }

      const hash = await bcrypt.hash(u.password, 10);
      const newUser = new User({
        email: u.email,
        passwordHash: hash
      });
      await newUser.save();
      console.log("Inserted user:", u.email);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

manageUsers();