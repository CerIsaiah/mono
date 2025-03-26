import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ ok: true, platform: 'Smoothrizz API' });
});

// Add more routes here
// app.use('/api/your-route', yourRouteHandler);

app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
});
