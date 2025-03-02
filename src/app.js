const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDatabase } = require('./config/database');
const { logger } = require('./config/logger');
const apiRoutes = require('./routes/api.routes');
// Import models to register them with Mongoose
require('./models/conversation');
require('./models/task');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Function to start server (exported for flexibility in different environments)
async function startServer() {
  try {
      await connectDatabase();
      const server = app.listen(PORT, () => {
          logger.info(`Server running on port ${PORT}`);
      });
      return server;
  } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
  }
}

// Start server only if this is the main module and not in test mode
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
      logger.error('Server startup failed:', error);
      process.exit(1);
  });
}

// Export necessary items for testing
module.exports = { app, connectDatabase, startServer };