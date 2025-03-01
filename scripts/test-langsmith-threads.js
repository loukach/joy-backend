// Test script for LangSmith Threads integration
require('../preload-dotenv');
const claudeService = require('../dist/services/claude.service').default;

// Add these environment variables directly to make sure they're set
// This is the simplest way to set thread ID according to LangSmith docs
process.env.LANGCHAIN_SESSION_ID = 'test-thread-fixed';
process.env.LANGCHAIN_THREADS = 'true'; // Enable threads explicitly

async function testLangSmithThreads() {
  console.log('🧪 Testing LangSmith Threads Integration');
  
  // Use a hardcoded thread ID for testing
  const threadId = 'test-thread-fixed';
  console.log(`📝 Using test thread ID: ${threadId}`);
  
  try {
    // Test 1: First message in thread
    console.log('\n🔄 Test 1: First message in thread');
    const response1 = await claudeService.translateToEnglish(
      'Bongu! Kif int?', // Hello! How are you? in Maltese
      threadId
    );
    console.log(`✅ Response: ${response1}`);
    
    // Test 2: Second message in same thread (same thread ID)
    console.log('\n🔄 Test 2: Second message in same thread');
    const response2 = await claudeService.translateToEnglish(
      'Jien tajjeb, grazzi. U int?', // I'm fine, thanks. And you? in Maltese
      threadId
    );
    console.log(`✅ Response: ${response2}`);
    
    // Test 3: Different function in same thread
    console.log('\n🔄 Test 3: Different function in same thread');
    const searchTerms = await claudeService.generateSearchTerms(
      'I want to volunteer with animals on weekends',
      threadId
    );
    console.log(`✅ Search terms: ${searchTerms.join(', ')}`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log(`\n📊 Check LangSmith dashboard for thread: ${threadId}`);
    console.log('URL: https://smith.langchain.com/');
    
    // Give LangSmith a moment to process the final trace before exiting
    // This helps ensure all traces are properly recorded
    console.log('\n⏳ Waiting a moment for LangSmith to process the final trace...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Done! Exiting...');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
testLangSmithThreads();