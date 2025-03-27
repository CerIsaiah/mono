import dotenv from 'dotenv';
import path from 'path';

// Load .env from apps/api/.env
const envPath = path.resolve(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', {
    error: result.error.message,
    searchPath: envPath,
    currentDir: __dirname,
    timestamp: new Date().toISOString()
  });
}

// Add this debug log right after loading env
console.log('Loaded Google Client ID:', {
  id: process.env.GOOGLE_CLIENT_ID?.substring(0, 8) + '...',
  exists: !!process.env.GOOGLE_CLIENT_ID,
  envPath,
  timestamp: new Date().toISOString()
});

// Log all available environment variables (excluding sensitive values)
console.log('Available environment variables:', {
  timestamp: new Date().toISOString(),
  vars: Object.keys(process.env).filter(key => !key.includes('KEY') && !key.includes('SECRET'))
});

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