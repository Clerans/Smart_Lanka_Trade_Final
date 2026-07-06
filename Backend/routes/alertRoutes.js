const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect: auth } = require('../middleware/authMiddleware'); // Assuming auth middleware exists

router.post('/', auth, alertController.createAlert);
router.get('/', auth, alertController.getUserAlerts);
router.delete('/:id', auth, alertController.deleteAlert);
router.post('/push-token', auth, alertController.savePushToken);

module.exports = router;
