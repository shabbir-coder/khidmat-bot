// models/user.js
const mongoose = require('mongoose');

const instanceSchema = new mongoose.Schema({
  access_token: String,
  instance_id: String,
  lastScannedAt: Date,
  number: Number,
  name: String,
  isActive: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Instance = mongoose.model('instance', instanceSchema);

module.exports = Instance;
