const express = require('express');
const conversationController = require('../controllers/conversation.controller');

const router = express.Router();

// Conversation endpoints
router.post('/chat/recommend', conversationController.handleMessage);
router.get('/conversations/:id', conversationController.getConversation);
router.get('/users/:userId/conversations', conversationController.getUserConversations);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

module.exports = router;