// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import routes
import chatRoutesModule from './routes/chatRoutes.js';  // Changed to default import

const app = express();
const PORT = process.env.PORT || 5000;

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create chunks directory if it doesn't exist
const chunksDir = path.join(__dirname, 'chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../Frontend')));

// Use routes
app.use('/api/chat', chatRoutesModule);
app.use('/api/chatGptService', chatRoutesModule);
console.log('check server.js routes');

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Development Files'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});