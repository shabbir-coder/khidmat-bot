// routes/authRoutes.js
const express = require('express');
const userController = require('../controllers/user');

const router = express.Router();

// Login route
router.post('/login', userController.loginUser);

// Refresh Token
router.post('/token', userController.refreshToken);

router.post('/refreshWebhook', userController.refreshWebhook);

// Logout route
router.post('/logout', userController.logoutUser);

// Forget password route
router.post('/forget-password', userController.forgotPassword);

// Reset password route
router.post('/reset-password/:token', userController.resetPassword);

module.exports = router;
