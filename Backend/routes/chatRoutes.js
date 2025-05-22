// routes/chatRoutes.js - routes for credit report analysis app 
import express from 'express';
import upload from '../utils/fileUpload.js';
import { chatController } from '../controllers/chatController.js';

const router = express.Router();

// Use the upload middleware for file uploads
router.post('/upload', upload.single('file'), (req, res) => {
  // Handle the uploaded file
  const filePath = req.file.path;
  // Process the file...
  res.json({ success: true, filePath });
});

// For multiple files
router.post('/upload-multiple', upload.array('files', 5), (req, res) => {
  // Handle multiple uploaded files
  const filePaths = req.files.map(file => file.path);
  // Process the files...
  res.json({ success: true, filePaths });
});

// Chat endpoint
router.post('/chat', chatController.handleChatMessage);

// Report analysis endpoint
router.post('/analyzeReports', upload.array('file', 5), chatController.analyzeReports);

// New route for dispute letter generation
router.post('/generateDisputeLetters', chatController.generateDisputeLetters);

// New route for cache management
router.get('/manage-cache', chatController.manageCache);

export default router;
