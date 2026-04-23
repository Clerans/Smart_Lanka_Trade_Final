const authService = require('../services/authService');
const { validateEmail, validatePassword } = require('../utils/validator');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    await authService.registerUser(name, email, password);
    res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await authService.loginUser(email, password);
    res.json(data);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await authService.verifyEmailToken(token);
    res.send(`<h1>Verification Successful</h1><p>${result.message}</p>`);
  } catch (err) {
    res.status(400).send(`<h1>Verification Failed</h1><p>${err.message}</p>`);
  }
};

exports.getUsers = async (req, res) => {
  try {
    const userModel = require('../models/userModel');
    const users = await userModel.findAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
