// Simple script to verify environment variables are loaded correctly
require('dotenv').config();

// ANSI color codes for formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

console.log(`${colors.bold}${colors.cyan}Environment Variables Check${colors.reset}\n`);

// Required variables
const requiredVars = [
  'MONGODB_URI',
  'CLAUDE_API_KEY',
  'PORT'
];

// Optional variables
const optionalVars = [
  'LANGSMITH_API_KEY',
  'LANGSMITH_PROJECT',
  'LANGCHAIN_TRACING_V2',
  'NODE_ENV',
  'LOG_LEVEL',
  'DB_NAME'
];

// Check required variables
console.log(`${colors.bold}Required Variables:${colors.reset}`);
let allRequiredPresent = true;

for (const varName of requiredVars) {
  const value = process.env[varName];
  let status;

  if (value) {
    let displayValue = value;
    
    // Mask API keys for security
    if (varName.includes('KEY') || varName.includes('URI')) {
      const firstChars = displayValue.substring(0, 4);
      const lastChars = displayValue.substring(displayValue.length - 4);
      displayValue = `${firstChars}...${lastChars}`;
    }
    
    status = `${colors.green}✓ SET${colors.reset} (${displayValue})`;
  } else {
    status = `${colors.red}✗ MISSING${colors.reset}`;
    allRequiredPresent = false;
  }
  
  console.log(`  ${colors.bold}${varName}:${colors.reset} ${status}`);
}

// Check optional variables
console.log(`\n${colors.bold}Optional Variables:${colors.reset}`);

for (const varName of optionalVars) {
  const value = process.env[varName];
  let status;

  if (value) {
    let displayValue = value;
    
    // Mask API keys for security
    if (varName.includes('KEY')) {
      const firstChars = displayValue.substring(0, 4);
      const lastChars = displayValue.substring(displayValue.length - 4);
      displayValue = `${firstChars}...${lastChars}`;
    }
    
    status = `${colors.green}✓ SET${colors.reset} (${displayValue})`;
  } else {
    status = `${colors.yellow}○ NOT SET${colors.reset}`;
  }
  
  console.log(`  ${colors.bold}${varName}:${colors.reset} ${status}`);
}

// Summary
console.log('\n' + '='.repeat(50));
if (allRequiredPresent) {
  console.log(`${colors.green}${colors.bold}✓ All required environment variables are set!${colors.reset}`);
  console.log(`You can start the server with: ${colors.cyan}./scripts/start-server.sh${colors.reset}`);
} else {
  console.log(`${colors.red}${colors.bold}✗ Some required environment variables are missing!${colors.reset}`);
  console.log(`Please check your ${colors.bold}.env${colors.reset} file and try again.`);
}