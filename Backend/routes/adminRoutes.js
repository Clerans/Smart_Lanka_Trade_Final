const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  getAuditLogs,
  updateUserRole
} = require('../controllers/adminController');
const { adminProtect } = require('../middleware/authMiddleware');

// All Admin routes require valid JWT with ADMIN role
router.get('/dashboard', adminProtect, getDashboardStats);
router.get('/users', adminProtect, getUsers);
router.get('/audit-logs', adminProtect, getAuditLogs);
router.put('/users/:id/role', adminProtect, updateUserRole);

module.exports = router;
