const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { debugState } = require('../controllers/debugController');

const router = express.Router();

router.get('/debug/state', requireAdmin, debugState);

module.exports = router;

