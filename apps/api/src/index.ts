import express from 'express';
import cors from 'cors';
import openaiRouter from './routes/openai';
import authRouter from './routes/auth';
import usageRouter from './routes/usage';
import swipesRouter from './routes/swipes';
import savedResponsesRouter from './routes/saved-responses';
import subscriptionRouter from './routes/subscription';
import learningPercentageRouter from './routes/learning-percentage';
import checkoutRouter from './routes/checkout';
import webhooksRouter from './routes/webhooks';
import cancelSubscriptionRouter from './routes/cancelSubscription';
import { logger } from './utils/logger';

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      message: error.message,
      stack: error.stack
    }
  });
  // Give the logger time to flush
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise
  });
});

// Debug log for environment
logger.info('Environment Check', {
  environment: process.env.NODE_ENV,
  googleClientId: !!process.env.GOOGLE_CLIENT_ID,
  port: process.env.PORT
});

logger.info('Node Environment', { env: process.env.NODE_ENV });
const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://smoothrizz.com',
  'https://www.smoothrizz.com',
  'https://mono-production-8ef9.up.railway.app',
  process.env.FRONTEND_URL
].filter(Boolean);

logger.info('CORS Configuration', { allowedOrigins });

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS Origin rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Add request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    contentType: req.headers['content-type']
  });
  next();
});

// IMPORTANT: Use express.raw() for the webhook BEFORE express.json()
// Stripe requires the raw body to verify webhook signatures.
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Middleware for parsing JSON and urlencoded data for other routes
// Increase the limit to 50MB for image uploads etc.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack
    },
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Smoothrizz API' });
});

// Log route mounting
logger.info('Mounting routes...');

// Mount your routes
app.use('/api', openaiRouter);
app.use('/auth', authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/swipes', swipesRouter);
app.use('/api/saved-responses', savedResponsesRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/learning-percentage', learningPercentageRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/cancelSubscription', cancelSubscriptionRouter);

logger.info('Routes mounted', {
  routes: [
    '/api',
    '/auth',
    '/api/usage',
    '/api/swipes',
    '/api/saved-responses',
    '/api/subscription',
    '/api/learning-percentage',
    '/api/checkout',
    '/api/webhooks',
    '/api/cancelSubscription'
  ]
});

// Add 404 handler after all routes
app.use((req, res, next) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
    contentType: req.headers['content-type']
  });
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
}).on('error', (error: NodeJS.ErrnoException) => {
  logger.error('Failed to start server', {
    error: {
      message: error.message,
      code: error.code,
      stack: error.stack
    }
  });
  // Give the logger time to flush
  setTimeout(() => process.exit(1), 1000);
}); 