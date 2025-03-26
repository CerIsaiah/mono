import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import openaiRouter from './routes/openai';  // Update this path

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Smoothrizz API' });
});
// Mount your OpenAI API route
app.use('/api', openaiRouter);

app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
}); 