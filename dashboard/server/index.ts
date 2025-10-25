const express = require('express');
const cors = require('cors');
const { featuresRouter } = require('./routes/features');
const { testsRouter } = require('./routes/tests');
const { configRouter } = require('./routes/config');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/features', featuresRouter);
app.use('/api/tests', testsRouter);
app.use('/api/config', configRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Dashboard server running on port ${PORT}`);
});

module.exports = app;
