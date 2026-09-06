const express = require('express');
const router = express.Router();
const {
  getInsights,
  getSentiment,
  getEvaluation,
  chatWithSomi
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.get('/insights', getInsights);
router.get('/sentiment', getSentiment);
router.get('/evaluation', getEvaluation);
router.post('/chat', chatWithSomi);

module.exports = router;
