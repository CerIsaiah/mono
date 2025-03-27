import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import openaiRouter from './routes/openai';  // Update this path
import authRouter from './routes/auth';

dotenv.config();

// Add this line to debug
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://smoothrizz.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    console.log('Incoming request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email']
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