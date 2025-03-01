const readline = require('readline');
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/chat/recommend';
let conversationId = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Joy Volunteer Chatbot CLI');
console.log('Type "exit" to quit\n');

function askQuestion() {
  rl.question('You: ', async (message) => {
    if (message.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    try {
      const payload = { message };
      if (conversationId) {
        payload.conversationId = conversationId;
      }

      const response = await axios.post(API_URL, payload);
      conversationId = response.data.conversationId;
      
      console.log(`\nBot: ${response.data.response}\n`);
    } catch (error) {
      console.error('Error:', error.response?.data?.error || error.message);
    }
    
    askQuestion();
  });
}

askQuestion();