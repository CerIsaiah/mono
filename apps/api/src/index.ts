import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import openaiRouter from './routes/openai';  // Update this path

dotenv.config();

// Add this line to debug
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// Increase the limit to 50MB for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Smoothrizz API' });
});
// Mount your OpenAI API route
app.use('/api', openaiRouter);

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
}); 