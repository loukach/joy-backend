// Test script for LangSmith User Threads integration
require('../preload-dotenv');
const claudeService = require('../dist/services/claude.service').default;

// Enable threads globally
process.env.LANGCHAIN_THREADS = 'true';

async function testLangSmithUserThreads() {
  console.log('🧪 Testing LangSmith User Threads Integration');
  
  // Create two separate users
  const userId1 = 'test-user-1';
  const userId2 = 'test-user-2';
  
  console.log('👥 Testing with two different users')
  
  try {
    // User 1's first message
    console.log(`\n🔄 User 1 (${userId1}): First message`);
    await claudeService.translateToEnglish(
      'Bongu!', // Hello! in Maltese
      userId1
    );
    
    // User 2's first message (different thread)
    console.log(`\n🔄 User 2 (${userId2}): First message`);
    await claudeService.translateToEnglish(
      'Kif int?', // How are you? in Maltese
      userId2
    );
    
    // User 1's second message (same thread as their first)
    console.log(`\n🔄 User 1 (${userId1}): Second message`);
    await claudeService.translateToEnglish(
      'Jien tajjeb!', // I'm good! in Maltese
      userId1
    );
    
    // User 1's third message using different function (should be in same thread)
    console.log(`\n🔄 User 1 (${userId1}): Search query`);
    await claudeService.generateSearchTerms(
      'I want to volunteer with animals',
      userId1
    );
    
    console.log('\n🎉 All tests completed successfully!');
    console.log(`\n📊 Check LangSmith dashboard for threads:`);
    console.log(`- User 1: user-${userId1}`);
    console.log(`- User 2: user-${userId2}`);
    console.log('URL: https://smith.langchain.com/');
    
    // Give LangSmith a moment to process the final trace before exiting
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
testLangSmithUserThreads();