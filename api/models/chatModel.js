const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ITS: { type: String, required: true },
  number: { type: String, required: true },
  isVerified : {type: Boolean, default: false},
  lastIzantaken: {type: Date},
  isAdmin: {type: Boolean, default: false}
});

const chatLogs = new mongoose.Schema({
  senderId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
  requestedITS: { type: String,  ref: 'contact'},
  isValid: {type: Boolean, default: false},
  finalResponse: {type: String},
  otherMessages : {type: {}},
  instance_id: {type: String},
  messageTrack: {type: String , default: null},
}, { timestamps: true }
);


const chatSchema = new mongoose.Schema({
  usedSet: {type: mongoose.Schema.Types.ObjectId, ref: 'setModel'},
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  recieverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  instance_id: {type: String},
  text: { type: String},
  type: {type: String},
  mediaUrl: {type: String},
  // Add other message-related fields as needed
}, { timestamps: true }
);

const ChatLogs = mongoose.model('chatLogs', chatLogs);
const Contact = mongoose.model('contact', contactSchema);
const Message = mongoose.model('message', chatSchema);

module.exports = { Contact, Message, ChatLogs };
