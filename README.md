# Joy Backend

Backend service for Joy, a volunteer matching chatbot.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the environment variables in the `.env` file.

## Development

Start the development server:
```bash
npm run dev
```

## Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Deployment to Render

### Manual Deployment

1. Create a new Web Service on Render
2. Connect your repository
3. Configure the following settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - Environment: `Node`
   - Region: (Choose closest to your users)
   - Branch: `main` (or your production branch)

4. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: Your MongoDB connection string
   - `CLAUDE_API_KEY`: Your Anthropic Claude API key
   - `LANGSMITH_API_KEY`: Your LangSmith API key
   - `LANGSMITH_PROJECT`: `joy-volunteer-matching`
   - `LANGCHAIN_TRACING_V2`: `true`

### Blueprint Deployment

Alternatively, you can use the Render YAML blueprint:

1. Push the `render.yaml` file to your repository
2. Go to the Render Dashboard and select "Blueprint" from the navigation
3. Select your repository and follow the prompts

## Testing

Run all tests:
```bash
npm test
```

Run unit tests:
```bash
npm run test:unit
```

Run integration tests:
```bash
npm run test:integration
```

## API Documentation

See the Postman collection for API documentation:
```bash
JoyFromGiving-API.postman_collection.json
```

## License

ISC