const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  url: String,
  status: {
    type: String,
    enum: ['active', 'pending', 'rejected', 'draft'],
    default: 'pending'
  },
  json: [],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
