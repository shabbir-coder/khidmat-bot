// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  phoneNo: Number,
  token: String,
  refreshToken: String,
  isActive: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model('user', userSchema);

module.exports = User;
