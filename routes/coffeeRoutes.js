const express = require('express');
const { requireApiKey, requireDeviceToken } = require('../middleware/auth');
const coffeeController = require('../controllers/coffeeController');

const router = express.Router();

// Webhook / automation source creates a pending command
router.post('/set', requireApiKey, coffeeController.setCoffeeCommand);

// Device polls for next command
router.get('/next', requireDeviceToken, coffeeController.getNextCoffeeCommand);

// Device acknowledges completion (kept API-key based for v1 simplicity)
router.post('/ack', requireApiKey, coffeeController.acknowledgeCoffeeCommand);

module.exports = router;

