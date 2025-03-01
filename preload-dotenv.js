require('dotenv').config();
console.log('Environment loaded: CLAUDE_API_KEY is ' + (process.env.CLAUDE_API_KEY ? 'set' : 'NOT SET'));
