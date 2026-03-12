const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/products-test', (req, res) => res.json({ test: true }));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/boms', require('./routes/bomRoutes'));
app.use('/api/production', require('./routes/productionRoutes'));

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Factory Flow ERP Backend is running' });
});

// Error Middleware
app.use(require('./middleware/errorMiddleware'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
