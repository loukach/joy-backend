#!/bin/bash

# Display a colorful header
echo -e "\033[1;36m======================================\033[0m"
echo -e "\033[1;36m   Joy Volunteer Chatbot Test Tool   \033[0m"
echo -e "\033[1;36m======================================\033[0m"
echo

# Check if a message is provided
if [ -z "$1" ]; then
  echo -e "\033[1;33mUsage: $0 \"your message here\" [language]\033[0m"
  echo -e "\033[1;33mExample: $0 \"I want to volunteer with animals\" en\033[0m"
  echo 
  echo -e "\033[1;33mUsing default message: \"I want to volunteer with children\"\033[0m"
  MESSAGE="I want to volunteer with children"
else
  MESSAGE="$1"
fi

# Check if a language is provided
if [ -z "$2" ]; then
  LANG="en"
else
  LANG="$2"
fi

# Make sure the cache directory exists (for Claude service caching)
mkdir -p cache

# Run the test with both message and language
node scripts/test-chat.js "$MESSAGE" "$LANG"