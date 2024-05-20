const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  message: String,
  messageType: String,
  imageUrl: String,
  url: String,
  timeStamp: String,
  mediaFile: {
    type: mongoose.Schema.Types.Mixed,
  },  
  extraButton: {
    type: mongoose.Schema.Types.Mixed,
  },
});

const setDataSchema = new mongoose.Schema({
  keywords: [String],
  answer: answerSchema,
});

const setSchema = new mongoose.Schema({
  setName: String,
  status: String,
  NumberVerifiedMessage: String,
  EntryPoint: String,
  ITSverificationMessage: String,
  // nextStepMessage: String,
  ITSverificationFailed: String,
  AcceptanceMessage: String,
  RejectionMessage: String,
  setData: [setDataSchema],
  createdBy: String,
  StartingTime: { type: Date },
  EndingTime: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const SetModel = mongoose.model('setModel', setSchema);

module.exports = SetModel;
