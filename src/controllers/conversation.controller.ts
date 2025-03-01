// Import necessary modules from express and services
import { Request, Response } from 'express';
import matchingService from '../services/matching.service';
import conversationService from '../services/conversation.service';
import { logger } from '../config/logger';

/**
 * ConversationController with LangSmith Threads Integration
 * 
 * When userId is provided:
 * 1. All conversations from the same user are stored in MongoDB with the same userId
 * 2. LangSmith groups all trace runs from the same userId into a single thread
 * 3. Thread ID format in LangSmith: user-${userId}
 * 
 * Benefits:
 * - Track the complete user journey across multiple messages
 * - Analyze conversation patterns for the same user over time
 * - Debug issues by seeing the full context of user interactions
 */
export class ConversationController {
    constructor() {
        // Bind the methods to the instance in the constructor
        this.handleMessage = this.handleMessage.bind(this);
        this.getConversation = this.getConversation.bind(this);
        this.getUserConversations = this.getUserConversations.bind(this);
      }

  // Method to handle incoming messages
  async handleMessage(req: Request, res: Response) {
    try {
      // Extract message, language, and optional userId from the request body
      const { message, language = 'en', userId } = req.body;
      
      console.log(`[THREAD DEBUG] Controller handling message with userId: "${userId}"`);
      console.log(`[THREAD DEBUG] Full request body:`, JSON.stringify(req.body));

      // If message is not provided, return a 400 error
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Log the user message to the conversation history
      const conversation = await conversationService.logUserMessage(message, userId);

      // Call the matching service to find matches for the message, passing userId for LangSmith tracking
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
  async getConversation(req: Request, res: Response) {
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
  async getUserConversations(req: Request, res: Response) {
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
export default new ConversationController();