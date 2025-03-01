const axios = require('axios');

// Command line arguments
const message = process.argv[2] || "I want to volunteer with children";
const language = process.argv[3] || "en"; // Default to English

// Configuration
const API_URL = 'http://localhost:4000/api/chat/recommend';

async function testChat() {
  console.log('\x1b[36m%s\x1b[0m', `🤖 Joy Volunteer Chatbot Test`);
  console.log('\x1b[33m%s\x1b[0m', `📋 Testing with message: "${message}" (language: ${language})`);
  console.log('-'.repeat(60));
  
  const startTime = Date.now();
  console.log('⏳ Sending request to chatbot...');
  
  try {
    // Make the API request
    const response = await axios.post(API_URL, { 
      message,
      language,
      userId: `test-user-${Date.now()}` // Generate a unique user ID for tracking
    });
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Display the response
    console.log('\x1b[32m%s\x1b[0m', `✅ Response received in ${responseTime/1000} seconds`);
    console.log('-'.repeat(60));
    console.log('\x1b[1m%s\x1b[0m', `Bot response:`);
    console.log(response.data.response);
    console.log('-'.repeat(60));
    console.log('\x1b[90m%s\x1b[0m', `Conversation ID: ${response.data.conversationId}`);
    
    // Offer help for viewing the conversation history
    console.log('\x1b[90m%s\x1b[0m', `\nTo view this conversation in the database:`);
    console.log('\x1b[90m%s\x1b[0m', `curl http://localhost:4000/api/conversations/${response.data.conversationId}`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Error occurred:');
    console.error(error.response?.data || error.message);
    
    // Common error information
    if (error.code === 'ECONNREFUSED') {
      console.log('\n\x1b[33m%s\x1b[0m', '📌 Is the server running? Try running:');
      console.log('   ./scripts/start-server.sh');
    }
    
    if (error.response?.status === 500) {
      console.log('\n\x1b[33m%s\x1b[0m', '📌 Server error. Check server logs for details.');
    }
    
    if (error.message.includes('CLAUDE_API_KEY')) {
      console.log('\n\x1b[33m%s\x1b[0m', '📌 Claude API key is missing or invalid. Check your .env file.');
    }
  }
}

testChat();