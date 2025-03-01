# Joy Volunteer Matching Backend

Backend service for the Joy volunteering platform that matches volunteers with opportunities.

## Features

- Volunteer matching using Claude AI
- Multilingual support with translation
- Conversation history tracking
- Task management and search
- LLM observability with LangSmith

## Setup

### Prerequisites

- Node.js 18+
- MongoDB
- Anthropic API key

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your environment variables
4. Start the development server: `npm run dev`

## Testing the Chatbot

### 1. Integration Test

Run the automated test:
```
npm run test:integration
```

### 2. Command Line Interface

Use the CLI client to interact with the chatbot:
```
node scripts/chat-cli.js
```

### 3. Simple API Test with curl

Test the API with a simple curl command:
```
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```
Note: Make sure `jq` is installed (e.g., `apt install jq` on Ubuntu).

### 4. Web Interface

1. Start the server:
   ```
   npm start
   ```

2. Open the test page in your browser:
   ```
   open scripts/test-page.html
   ```
   or simply open the file in your browser.

### 5. Using Mock Service for Testing

For testing without using the real Claude API (no API key needed):

1. Edit `src/services/matching.service.ts` to import the mock service:
   ```typescript
   // import claudeService from './claude.service';
   import claudeService from './claude.service.mock';
   ```
2. Rebuild and restart the server.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | Yes |
| MONGODB_URI | MongoDB connection string | Yes |
| CLAUDE_API_KEY | Anthropic Claude API key | Yes |
| LANGSMITH_API_KEY | LangSmith API key for LLM observability | No |
| LANGSMITH_PROJECT | LangSmith project name | No |
| LANGCHAIN_TRACING_V2 | Enable LangChain tracing | No |

## LangSmith Integration

This project uses LangSmith to monitor and debug Claude API calls. To enable LangSmith:

1. Create an account at [LangSmith](https://smith.langchain.com/)
2. Create a new project in LangSmith
3. Add your LangSmith API key to your `.env` file
4. Set `LANGSMITH_PROJECT` to your project name
5. Set `LANGCHAIN_TRACING_V2=true`

LangSmith will track:
- All Claude API calls
- Input and output data
- Cache hits
- Errors
- Latency
- User IDs (if provided)

## API Endpoints

### Conversations

- `POST /api/conversation` - Process a new message
- `GET /api/conversation/:id` - Get a conversation by ID
- `GET /api/conversation/user/:userId` - Get all conversations for a user

### Tasks

- `GET /api/tasks` - Get all volunteer tasks
- `GET /api/tasks/:id` - Get a specific task
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

## License

MIT