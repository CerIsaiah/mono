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

// Debug log for environment
console.log('Environment Check:', {
  environment: process.env.NODE_ENV,
  googleClientId: !!process.env.GOOGLE_CLIENT_ID,
  port: process.env.PORT
});

console.log('Node Environment:', process.env.NODE_ENV);
const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://smoothrizz.com',
  'https://www.smoothrizz.com',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// IMPORTANT: Use express.raw() for the webhook BEFORE express.json()
// Stripe requires the raw body to verify webhook signatures.
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Middleware for parsing JSON and urlencoded data for other routes
// Increase the limit to 50MB for image uploads etc.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Smoothrizz API' });
});

// Mount your routes
app.use('/api', openaiRouter);
app.use('/auth', authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/swipes', swipesRouter);
app.use('/api/saved-responses', savedResponsesRouter);
app.use('/api/subscription-status', subscriptionRouter);
app.use('/api/learning-percentage', learningPercentageRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/cancel-subscription', cancelSubscriptionRouter);

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
}); 