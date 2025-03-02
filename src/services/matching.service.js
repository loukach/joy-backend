const claudeService = require('./claude.service');

class MatchingService {
    // Find matches for a given message and language using function calling
    async findMatches(message, language, userId) {
        console.log(`💬 Processing message: "${message.substring(0, 50)}..."`);
        
        // Create the system message with instructions
        const systemMessage = {
            role: "system",
            content: `You are a helpful volunteer matching assistant. Your goal is to help people find volunteer opportunities that match their interests and skills.
            
If the user writes in a language other than English, use the translate_text function to translate their message to English for processing, and translate your response back to their language.

Use the search_tasks function to find volunteer opportunities that match the user's interests.
            
When providing recommendations:
1. Be friendly and enthusiastic
2. Acknowledge the user's specific interests
3. Suggest 2-3 relevant volunteer opportunities that match their interests
4. Ask a follow-up question to refine future recommendations

If no matches are found:
1. Be friendly and encouraging
2. Ask specific follow-up questions to gather information about:
   - Skills and experience
   - Time availability
   - Location preferences
   - Preferred cause areas
   - Type of work they want to do`
        };
        
        // Create the user message
        const userMessage = {
            role: "user",
            content: message
        };
        
        // Build conversation history
        const messages = [systemMessage, userMessage];
        
        // Use the new function calling approach
        return await claudeService.handleConversation(messages, language, userId);
    }
}

const matchingService = new MatchingService();
module.exports = matchingService;