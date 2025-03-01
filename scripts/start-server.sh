#!/bin/bash

echo "Starting Joy backend server with full-featured Claude service..."
echo "Press Ctrl+C to stop the server"
echo 

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# First, check if environment variables are set properly
echo "Checking environment variables..."
node scripts/check-env.js

# Check if the port is already in use
PORT=$(grep "^PORT=" .env | cut -d '=' -f2)
if lsof -i:"${PORT}" > /dev/null ; then
  echo -e "\033[1;31mError: Port ${PORT} is already in use. Please specify a different port in .env or stop the other process.\033[0m"
  echo -e "\033[1;33mTo check what's using the port, run: lsof -i:${PORT}\033[0m"
  exit 1
fi
echo -e "\033[1;32mPort ${PORT} is available\033[0m"

# Check if the service exists
if [ ! -f src/services/claude.service.ts ]; then
  echo "Error: Simple Claude service file not found."
  exit 1
fi

# Make sure the cache directory exists
mkdir -p cache

# Explicitly preload dotenv to ensure environment variables are available
cat << EOF > preload-dotenv.js
require('dotenv').config();
console.log('Environment loaded: CLAUDE_API_KEY is ' + (process.env.CLAUDE_API_KEY ? 'set' : 'NOT SET'));
EOF

# Start the server with ts-node and dotenv preload
npx -y ts-node -r ./preload-dotenv.js src/app.ts