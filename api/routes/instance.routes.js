// routes/userRoutes.js
const express = require('express');
const instanceController = require('../controllers/instance.controller');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Get user by ID route
router.get('', authenticateToken, instanceController.createQr);

router.get('/setWebHook/:id', authenticateToken, instanceController.setWebhook);

router.post('/save', authenticateToken, instanceController.createInstance);

router.delete('/:id', authenticateToken, instanceController.deleteInstance);

router.get('/list', authenticateToken, instanceController.listAll);

router.get('/getQr/:instanceId', authenticateToken, instanceController.getQr);

router.post('/update/:instanceId', authenticateToken, instanceController.updateInstance);


module.exports = router;
