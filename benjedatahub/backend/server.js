require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Initialize Express app
const app = express();

// Database Connection
connectDB();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for white-label reseller domain mappings
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());

// Load routers
const authRoutes = require('./routes/auth');
const resellerRoutes = require('./routes/reseller');
const paystackRoutes = require('./routes/paystack');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');

// Bind routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reseller', resellerRoutes);
app.use('/api/v1/payment', paystackRoutes);
app.use('/api/v1/order', orderRoutes);
app.use('/api/v1/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BenjeDataHub API is online and running' });
});

// Root welcome message
app.get('/', (req, res) => {
  res.send('Welcome to the BenjeDataHub Telecom Reseller API. Ready to process orders.');
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
