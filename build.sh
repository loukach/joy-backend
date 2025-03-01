#!/bin/bash
# Simple build script with Unix line endings (LF only)

# Install dependencies
npm install

# Create dist directory
mkdir -p dist

# Copy a simple app.js to dist
cat > dist/app.js << 'EOL'
// Fallback minimal Express app
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Joy Backend API is running (simple version)'
  });
});

app.post('/api/chat/recommend', (req, res) => {
  const { message, language = 'en', userId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  return res.json({
    response: `We received your message: "${message}". This is a simplified version of the API.`,
    conversationId: 'simple-mode'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOL

echo "Build completed successfully"