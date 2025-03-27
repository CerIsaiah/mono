import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import openaiRouter from './routes/openai';  // Update this path
import authRouter from './routes/auth';

// Add this line to debug
console.log('Environment Check:', {
  googleClientId: !!process.env.GOOGLE_CLIENT_ID,
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT
});

const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://smoothrizz.com',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));


// Increase the limit to 50MB for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Smoothrizz API' });
});

// Mount your OpenAI API route
app.use('/api', openaiRouter);
// Mount auth routes
app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
}); 