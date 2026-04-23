const express = require('express');
const router = express.Router();
const { login, register, getUsers, verifyEmail } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);
router.get('/verify/:token', verifyEmail);

module.exports = router;
