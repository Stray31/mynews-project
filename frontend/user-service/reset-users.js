require('dotenv').config();   // Make sure your .env has MONGO_URI
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  email: String,
  passwordHash: String
});

const User = mongoose.model('User', UserSchema, 'users'); // explicitly point to users collectionn

async function resetUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    // Delete all users
    await User.deleteMany({});
    console.log("All users deleted");

    // Create a test user
    const password = 'mypassword';  // change this to whatever you want
    const hash = await bcrypt.hash(password, 10);

    const testUser = new User({
      email: 'testuser@example.com',  // change email if you want
      passwordHash: hash

      
    });

    await testUser.save();
    console.log("Test user inserted:", testUser.email);

    process.exit(0);  // Exit script
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetUsers();