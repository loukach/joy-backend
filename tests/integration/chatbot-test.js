const supertest = require('supertest');
const { app, startServer } = require('../../dist/app');
const mongoose = require('mongoose');

let server;
let request;

beforeAll(async () => {
  server = await startServer();
  request = supertest(app);
});

afterAll(async () => {
  await mongoose.connection.close();
  await server.close();
});

describe('Chatbot API', () => {
  it('should respond to a chat message', async () => {
    const response = await request
      .post('/api/chat/recommend')
      .send({ message: "I want to volunteer with children" });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('response');
    expect(response.body).toHaveProperty('conversationId');
  });
});