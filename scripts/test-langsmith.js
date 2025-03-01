// Simple script to test LangSmith connectivity with LangChain
// Run with: node scripts/test-langsmith.js

require('dotenv').config();
const { ChatAnthropic } = require('@langchain/anthropic');
const { Client } = require('langsmith');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');

// Configure environment variables for LangSmith tracing
process.env.LANGCHAIN_TRACING_V2 = 'true';
if (!process.env.LANGCHAIN_PROJECT) {
  process.env.LANGCHAIN_PROJECT = 'joy-volunteer-matching'; // Set a default project
}

async function testLangSmithConnection() {
  console.log('Testing LangSmith connectivity...');
  
  // Check if API keys are set
  const langsmithApiKey = process.env.LANGSMITH_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  
  if (!langsmithApiKey) {
    console.error('❌ LANGSMITH_API_KEY environment variable is not set');
    return;
  } else {
    console.log('✅ LANGSMITH_API_KEY is set');
  }
  
  if (!claudeApiKey) {
    console.error('❌ CLAUDE_API_KEY environment variable is not set');
    return;
  } else {
    console.log('✅ CLAUDE_API_KEY is set');
  }

  // Check relevant environment variables
  console.log('LangSmith configuration:');
  console.log(`  LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT || '(not set)'}`);
  console.log(`  LANGCHAIN_TRACING_V2: ${process.env.LANGCHAIN_TRACING_V2 || '(not set)'}`);
  console.log(`  LANGCHAIN_ENDPOINT: ${process.env.LANGCHAIN_ENDPOINT || '(not set)'}`);
  
  try {
    // Initialize LangSmith client directly (for API tests)
    const client = new Client();
    console.log('✅ LangSmith client initialized');
    
    // Test 1: Check API connectivity by listing projects
    console.log('\n📋 Test 1: Testing direct API connectivity...');
    const apiData = await client.listProjects();
    console.log(`✅ API connection successful!`);
    console.log(`API response:`, JSON.stringify(apiData, null, 2));
    
    // Test 2: Run a simple Claude API call with LangChain tracing
    console.log('\n🔄 Test 2: Testing LangChain automatic tracing...');
    
    // Initialize the LangChain model
    const model = new ChatAnthropic({
      anthropicApiKey: claudeApiKey,
      modelName: 'claude-3-haiku-20240307'
    });
    
    // Create a simple chain with proper naming
    const prompt = PromptTemplate.fromTemplate('Tell me a short joke about {topic}');
    const outputParser = new StringOutputParser();
    
    // Create chain
    const chain = prompt.pipe(model).pipe(outputParser);
    
    // Invoke the chain (this should automatically trace to LangSmith)
    console.log('Invoking chain with LangChain...');
    const result = await chain.invoke({ topic: 'programming' }, {
      // Add run name and tags for better traceability in LangSmith
      runName: "JoyBot-TestJoke",
      tags: ["joy-volunteer-matching", "test"],
      // Add additional metadata for this specific run
      metadata: {
        test_id: `test-${Date.now()}`,
        test_case: 'joke_generation'
      }
    });
    
    console.log(`✅ Chain execution complete! Result:`);
    console.log(result);
    console.log('\nThis run should now be visible in your LangSmith dashboard');
    console.log(`Project: ${process.env.LANGCHAIN_PROJECT}`);
    
  } catch (error) {
    console.error('❌ Error in LangSmith test:');
    console.error(error);
    
    if (error.response) {
      console.error('API Response:', error.response.data);
      console.error('Status:', error.response.status);
    }
  }
}

testLangSmithConnection().catch(err => {
  console.error('Fatal error:', err);
});