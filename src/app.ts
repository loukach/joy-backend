import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { logger } from './config/logger';
import apiRoutes from './routes/api.routes';
// Import models to register them with Mongoose
import './models/conversation';
import './models/task';

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
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Function to start server (exported for flexibility in different environments)
export async function startServer() {
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
export { app, connectDatabase };