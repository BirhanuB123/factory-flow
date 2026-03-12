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

// Import Controllers
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('./controllers/productController');
const { getBoms, getBom, createBom, updateBom, deleteBom } = require('./controllers/bomController');
const { getJobs, getJob, createJob, updateJob, deleteJob } = require('./controllers/productionController');
const { getClients, getClient, createClient, updateClient, deleteClient } = require('./controllers/clientController');
const { getOrders, getOrder, createOrder, updateOrder, deleteOrder } = require('./controllers/orderController');

// API Routes
app.get('/api/products', getProducts);
app.post('/api/products', createProduct);
app.get('/api/products/:id', getProduct);
app.put('/api/products/:id', updateProduct);
app.delete('/api/products/:id', deleteProduct);

app.get('/api/boms', getBoms);
app.post('/api/boms', createBom);
app.get('/api/boms/:id', getBom);
app.put('/api/boms/:id', updateBom);
app.delete('/api/boms/:id', deleteBom);

app.get('/api/production', getJobs);
app.post('/api/production', createJob);
app.get('/api/production/:id', getJob);
app.put('/api/production/:id', updateJob);
app.delete('/api/production/:id', deleteJob);

app.get('/api/clients', getClients);
app.post('/api/clients', createClient);
app.get('/api/clients/:id', getClient);
app.put('/api/clients/:id', updateClient);
app.delete('/api/clients/:id', deleteClient);

app.get('/api/orders', getOrders);
app.post('/api/orders', createOrder);
app.get('/api/orders/:id', getOrder);
app.put('/api/orders/:id', updateOrder);
app.delete('/api/orders/:id', deleteOrder);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Factory Flow ERP Backend is running' });
});

// Error Middleware
app.use(require('./middleware/errorMiddleware'));

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
