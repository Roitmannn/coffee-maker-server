const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// UI/dashboard endpoints (admin-only)
router.get('/overview', requireAdmin, adminController.overview);

// Enqueue a coffee command from the UI (admin-only).
// This simulates an external webhook client, but uses ADMIN_TOKEN instead of API_KEY.
router.post('/coffee/make', requireAdmin, adminController.makeCoffee);

// Clear the command history for all devices (admin-only).
router.delete('/history', requireAdmin, adminController.clearHistory);

module.exports = router;

