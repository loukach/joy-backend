// Import necessary modules from express and services
const matchingService = require('../services/matching.service');
const conversationService = require('../services/conversation.service');
const { logger } = require('../config/logger');

class ConversationController {
  constructor() {
    // Bind methods to this instance
    this.handleMessage = this.handleMessage.bind(this);
    this.getConversation = this.getConversation.bind(this);
    this.getUserConversations = this.getUserConversations.bind(this);
  }

  // Method to handle incoming messages
  async handleMessage(req, res) {
    try {
      // Extract message, language, and optional userId from the request body
      const { message, language = 'en', userId } = req.body;

      // If message is not provided, return a 400 error
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Log the user message to the conversation history
      const conversation = await conversationService.logUserMessage(message, userId);

      // Call the matching service to find matches using function calling
      const botResponse = await matchingService.findMatches(message, language, userId);
      
      // Log the bot response to the conversation history
      await conversationService.logBotResponse(conversation._id, botResponse);

      // Return the response from the matching service along with the conversation ID
      return res.json({ 
        response: botResponse,
        conversationId: conversation._id 
      });
    } catch (error) {
      // Log the error and return a 500 error with details
      logger.error('Error handling message:', error);
      return res.status(500).json({ 
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method to retrieve a single conversation by ID
  async getConversation(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }

      const conversation = await conversationService.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      return res.json(conversation);
    } catch (error) {
      logger.error('Error retrieving conversation:', error);
      return res.status(500).json({
        error: 'Failed to retrieve conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method to retrieve all conversations for a user
  async getUserConversations(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const conversations = await conversationService.getUserConversations(userId);
      return res.json(conversations);
    } catch (error) {
      logger.error('Error retrieving user conversations:', error);
      return res.status(500).json({
        error: 'Failed to retrieve user conversations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export an instance of the ConversationController
const conversationController = new ConversationController();
module.exports = conversationController;