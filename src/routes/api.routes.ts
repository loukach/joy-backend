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

// Export the router instance
export default router;