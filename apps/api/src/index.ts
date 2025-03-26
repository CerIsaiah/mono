import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

// Add a root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Smoothrizz API' });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ ok: true, platform: 'Smoothrizz API' });
});

// Add more routes here
// app.use('/api/your-route', yourRouteHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API running on port ${PORT}`);
});
