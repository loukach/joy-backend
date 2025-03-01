// A simple script to check if conversations are being logged
const mongoose = require('mongoose');
require('dotenv').config();

async function checkConversations() {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/joy-db';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Query the conversations collection
  const conversations = await mongoose.connection.collection('conversations').find({}).toArray();
  console.log(`Found ${conversations.length} conversations`);
  
  // Display the conversations
  conversations.forEach((conversation, index) => {
    console.log(`\nConversation ${index + 1}:`);
    console.log(`ID: ${conversation._id}`);
    console.log(`User ID: ${conversation.userId || 'No user ID'}`);
    console.log(`Created at: ${conversation.createdAt}`);
    console.log('Messages:');
    
    conversation.messages.forEach((message, msgIndex) => {
      console.log(`  ${msgIndex + 1}. [${message.role}]: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
    });
  });

  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
}

// Run the function
checkConversations().catch(console.error);