const { ConversationModel } = require('../models/conversation');
const { logger } = require('../config/logger');

class ConversationService {
    // Log a user message and create or update a conversation
    async logUserMessage(message, userId = null) {
        try {
            // Create a new conversation or find an existing one for this user
            let conversation;
            
            if (userId) {
                // Try to find the most recent conversation for this user
                conversation = await ConversationModel.findOne(
                    { userId },
                    {},
                    { sort: { updatedAt: -1 } }
                );
                
                // If no conversation or the last one is older than 24 hours, create a new one
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                if (!conversation || conversation.updatedAt < oneDayAgo) {
                    conversation = new ConversationModel({ userId });
                }
            } else {
                // No userId, always create a new conversation
                conversation = new ConversationModel();
            }
            
            // Add the user message
            conversation.messages.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            // Save the conversation
            await conversation.save();
            
            logger.info(`Logged user message for conversation ${conversation._id}`);
            return conversation;
        } catch (error) {
            logger.error('Error logging user message:', error);
            throw error;
        }
    }
    
    // Log a bot response to an existing conversation
    async logBotResponse(conversationId, response) {
        try {
            const conversation = await ConversationModel.findById(conversationId);
            
            if (!conversation) {
                throw new Error(`Conversation not found: ${conversationId}`);
            }
            
            // Add the bot message
            conversation.messages.push({
                role: 'bot',
                content: response,
                timestamp: new Date()
            });
            
            // Save the conversation
            await conversation.save();
            
            logger.info(`Logged bot response for conversation ${conversationId}`);
            return conversation;
        } catch (error) {
            logger.error(`Error logging bot response for conversation ${conversationId}:`, error);
            throw error;
        }
    }
    
    // Get a conversation by ID
    async getConversation(conversationId) {
        try {
            return await ConversationModel.findById(conversationId);
        } catch (error) {
            logger.error(`Error retrieving conversation ${conversationId}:`, error);
            throw error;
        }
    }
    
    // Get all conversations for a user
    async getUserConversations(userId) {
        try {
            return await ConversationModel.find(
                { userId },
                {},
                { sort: { updatedAt: -1 } }
            );
        } catch (error) {
            logger.error(`Error retrieving conversations for user ${userId}:`, error);
            throw error;
        }
    }
}

const conversationService = new ConversationService();
module.exports = conversationService;