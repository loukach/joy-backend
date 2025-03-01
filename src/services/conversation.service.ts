import { Conversation, IConversation } from '../models/conversation';
import { logger } from '../config/logger';

class ConversationService {
  /**
   * Creates a new conversation or adds to an existing one
   * @param message The user message
   * @param userId Optional user identifier
   * @returns The conversation document
   */
  async logUserMessage(message: string, userId?: string): Promise<IConversation> {
    try {
      // Find existing conversation or create a new one
      let conversation;
      
      if (userId) {
        // Try to find the most recent conversation for this user
        conversation = await Conversation.findOne({ userId })
          .sort({ updatedAt: -1 })
          .exec();
      }
      
      if (!conversation) {
        // Create a new conversation if none exists
        // Create a new conversation with mongoose
        conversation = new Conversation({
          userId,
          messages: []
        });
      }
      
      // Add the user message
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
      
      // Save the conversation
      await conversation.save();
      return conversation;
    } catch (error) {
      logger.error('Error logging user message:', error);
      throw error;
    }
  }
  
  /**
   * Logs a bot response to a conversation
   * @param conversationId The conversation ID
   * @param response The bot's response
   * @returns The updated conversation
   */
  async logBotResponse(conversationId: string, response: string): Promise<IConversation | null> {
    try {
      // Find the conversation
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        logger.warn(`Conversation not found: ${conversationId}`);
        return null;
      }
      
      // Add the bot message
      conversation.messages.push({
        role: 'bot',
        content: response,
        timestamp: new Date()
      });
      
      // Save the conversation
      await conversation.save();
      return conversation;
    } catch (error) {
      logger.error('Error logging bot response:', error);
      throw error;
    }
  }
  
  /**
   * Retrieves a conversation by ID
   * @param conversationId The conversation ID
   * @returns The conversation document
   */
  async getConversation(conversationId: string): Promise<IConversation | null> {
    try {
      return await Conversation.findById(conversationId);
    } catch (error) {
      logger.error('Error retrieving conversation:', error);
      throw error;
    }
  }
  
  /**
   * Gets all conversations for a user
   * @param userId The user ID
   * @returns Array of conversations
   */
  async getUserConversations(userId: string): Promise<IConversation[]> {
    try {
      return await Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .exec();
    } catch (error) {
      logger.error('Error retrieving user conversations:', error);
      throw error;
    }
  }
}

export default new ConversationService();