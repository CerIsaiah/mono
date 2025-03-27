import express from 'express';
import cors from 'cors';
import openaiRouter from './routes/openai';  // Update this path
import authRouter from './routes/auth';

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