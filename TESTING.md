# Testing the Joy Chatbot Service

This document provides simple ways to test the full-featured chatbot service with the real Claude AI.

## Prerequisites

Make sure you have:
- Node.js installed
- MongoDB running (connection string in `.env`)
- Claude API key in `.env` file
- Port 4000 available (or change PORT in .env)
  
The test scripts use the full-featured Claude service implementation with:
- API call caching (speeds up repeated queries)
- LangSmith integration (for monitoring and debugging)
- Console logging of all operations

## Option 1: Command Line Testing (Simplest)

1. Start the server:
   ```
   ./scripts/start-fixed-server.sh
   ```

2. In a new terminal window, run a test with:
   ```
   ./scripts/run-test.sh "I want to volunteer with animals"
   ```
   
   You can replace the message with any query you want to test.

## Option 2: Interactive CLI Session

1. Start the server:
   ```
   ./scripts/start-fixed-server.sh
   ```

2. In a new terminal window, start the interactive CLI:
   ```
   node scripts/chat-cli.js
   ```

3. Type messages and receive responses. Type "exit" to quit.

## Option 3: Web Interface

1. Start the server:
   ```
   ./scripts/start-fixed-server.sh
   ```

2. Open the test page in your browser:
   ```
   open scripts/test-page.html
   ```
   (or navigate to the file in your file browser and open it)

## Troubleshooting

1. **Server won't start**
   - Check if MongoDB is running
   - Verify your .env file has valid values
   - Look for errors in the console output

2. **Authentication errors**
   - Verify your CLAUDE_API_KEY is valid and not expired
   - Check MongoDB connection string

3. **No response from chatbot**
   - Check server logs for errors
   - Verify the request is reaching the server