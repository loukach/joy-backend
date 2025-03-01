// Import necessary modules from express and the conversation controller
import {  Router, Request, Response } from 'express';
import conversationController from '../controllers/conversation.controller';

// Create a new router instance
const router = Router();

// Endpoint for chat recommendations
router.post('/chat/recommend', async (req: Request, res: Response) => {
    await conversationController.handleMessage(req, res);
});

// Endpoints for conversation history
router.get('/conversations/:id', async (req: Request, res: Response) => {
    await conversationController.getConversation(req, res);
});

router.get('/users/:userId/conversations', async (req: Request, res: Response) => {
    await conversationController.getUserConversations(req, res);
});

// Test endpoint for debugging LangSmith threads
router.post('/test-thread', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        
        console.log(`[THREAD DEBUG] Test endpoint called with userId: "${userId}"`);
        
        // Set LangSmith thread ID directly using environment variables
        if (userId) {
            process.env.LANGCHAIN_SESSION_ID = `user-${userId}`;
            process.env.LANGCHAIN_TRACING_THREAD_ID = `user-${userId}`;
            console.log(`[THREAD DEBUG] Manually set thread ID environment variables to user-${userId}`);
        }
        
        // Import claude service directly in this function scope
        const claudeService = require('../services/claude.service').default;
        
        // Simple test of the Claude service with thread ID
        console.log(`[THREAD DEBUG] Calling translateToEnglish with userId: ${userId}`);
        const result = await claudeService.translateToEnglish(
            'Testing thread with userId: ' + userId,
            userId
        );
        
        console.log(`[THREAD DEBUG] Test successful. Trace should be in thread: user-${userId}`);
        
        res.json({ 
            success: true, 
            result,
            userId,
            threadId: `user-${userId}`,
            message: "Check the logs and LangSmith dashboard for thread details" 
        });
    } catch (error) {
        console.error('Test thread endpoint error:', error);
        res.status(500).json({ error: 'Test failed', details: error instanceof Error ? error.message : String(error) });
    }
});

// Export the router instance
export default router;