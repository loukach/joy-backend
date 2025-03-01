// Test script for directly testing LangSmith Threads
require('../preload-dotenv');

// Set up environment for LangSmith threads
process.env.LANGCHAIN_THREADS = "true";

// Import after setting environment variables
const claudeService = require('../dist/services/claude.service').default;

async function testThreadsDirect() {
  try {
    // Use a consistent thread ID
    const threadId = 'direct-test-' + Date.now();
    console.log(`Using thread ID: ${threadId}`);
    
    // Manually set the thread ID environment variables
    process.env.LANGCHAIN_SESSION_ID = threadId;
    
    // Make 3 calls with the same thread ID
    console.log("Making first call...");
    await claudeService.translateToEnglish("Hello", threadId);
    
    console.log("Making second call...");
    await claudeService.translateToEnglish("How are you?", threadId);
    
    console.log("Making third call...");
    await claudeService.generateSearchTerms("I want to volunteer", threadId);
    
    console.log(`All done! Check LangSmith for thread: ${threadId}`);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testThreadsDirect();