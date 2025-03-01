// Fallback minimal Express app for Render deployment
// This is used if the TypeScript build fails completely

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create the app
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Ensure cache directory exists
const cacheDir = path.join(process.cwd(), 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Cache directory created at ${cacheDir}`);
}

// Root route for health checks
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Joy Backend API is running (fallback version)',
    env: process.env.NODE_ENV,
    config: {
      langsmithProject: process.env.LANGSMITH_PROJECT || '(not set)',
      langchainTracing: process.env.LANGCHAIN_TRACING_V2 || '(not set)',
      mongo: process.env.MONGODB_URI ? 'configured' : 'not configured',
      claude: process.env.CLAUDE_API_KEY ? 'configured' : 'not configured'
    }
  });
});

// Chat recommendation endpoint (stub)
app.post('/api/chat/recommend', (req, res) => {
  const { message, language = 'en', userId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Log receipt of message
  console.log(`Received message: "${message}" in language: ${language} from user: ${userId || 'anonymous'}`);

  // Return stub response
  return res.json({
    response: `[FALLBACK MODE] We received your message: "${message}". However, the system is currently in fallback mode due to deployment issues. Please check back later.`,
    conversationId: 'fallback-mode'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`⚠️ FALLBACK SERVER running on port ${PORT}`);
  console.log('This is running in emergency fallback mode due to build issues');
  console.log('If you see this in production, please check build logs and fix the TypeScript errors');
});