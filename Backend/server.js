// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'JAM Capital Consultants is running' });
});

// Route to serve Interface.html
app.get('/portal', (req, res) => {
  const filePath = path.join(__dirname, '../Portal/Interface.html');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading Interface.html:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error loading Portal interface' 
      });
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(data);
  });
});

// Serve static files from the Portal directory
app.use('/portal-assets', express.static(path.join(__dirname, '../Portal')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});