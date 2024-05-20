// routes/userRoutes.js
const express = require('express');
const cmsController = require('../controllers/cms.controller');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

router.post('', authenticateToken, cmsController.addSet);
router.post('/validatekeywords', authenticateToken, cmsController.validatekeywords);
router.put('/:id', authenticateToken, cmsController.updateSet);
router.get('/:id', authenticateToken, cmsController.getSetById);
router.delete('/:id', authenticateToken, cmsController.deleteSet);
router.patch('/:id/update-status', authenticateToken, cmsController.updateSetStatus);
router.get('', authenticateToken, cmsController.getSetsList);

module.exports = router;
