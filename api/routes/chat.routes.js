// routes/userRoutes.js
const express = require('express');
const chatsController = require('../controllers/chats.controller');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');


const router = express.Router();

// Set up storage strategy for Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/') // make sure this folder exists
    },
    filename: function (req, file, cb) {
      // You can use the original name or add a timestamp for uniqueness
      cb(null, Date.now() + '-' + file.originalname.trim().replaceAll(' ',''))
    }
  });
  const upload = multer({ storage: storage });


// Get user by ID route
router.post('/saveContact', authenticateToken, chatsController.saveContact);


router.post('/updateContact/:id', authenticateToken, chatsController.updateContacts);

router.get('/getContacts', authenticateToken, chatsController.getContact);

router.post('/getMessages', authenticateToken, chatsController.getMessages);

router.post('/sendMessage', authenticateToken, chatsController.sendMessages);

router.post('/recieveMessage', chatsController.recieveMessages);

router.get('/getreport/:id', chatsController.getReport);

router.post('/uploadPicture', authenticateToken, upload.single('picture'), (req, res) => {
    if (!req.file) {
      return res.status(400).send({ message: 'Please upload a file.' });
    }

    res.status(200).send({
      message: 'File uploaded successfully.',
      filePath: req.file.path
    });
  });

module.exports = router;
