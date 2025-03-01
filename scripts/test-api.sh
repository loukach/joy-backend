#!/bin/bash

echo "Testing chatbot API..."

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to volunteer with animals"}' \
  http://localhost:3000/api/chat/recommend)

echo "Response:"
echo $RESPONSE | jq .