const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Public / Demo AI Recommendation routes
router.get('/recommendations', aiController.getAllRecommendations);
router.get('/recommendation/:symbol', aiController.getSingleRecommendation);
router.get('/history/:symbol', aiController.getRecommendationHistory);
router.post('/chat', aiController.chatWithSOMI);

module.exports = router;
