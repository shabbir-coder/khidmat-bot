// routes/userRoutes.js
const express = require('express');
const cmsController = require('../controllers/cms.controller');
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



router.get('',  authenticateToken, cmsController.listAllFiles);
router.get('/:id', authenticateToken, cmsController.getFile);
router.post('/upload', authenticateToken , upload.single('file'), cmsController.uploadFile);
router.delete('/:id', authenticateToken, cmsController.deleteFile);
router.post('/:id/status', authenticateToken, cmsController.updateFileStatus);

module.exports = router;
