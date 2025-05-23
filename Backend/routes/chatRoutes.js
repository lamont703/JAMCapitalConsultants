// routes/chatRoutes.js - routes for credit report analysis app 
import express from 'express';
import multer from 'multer';
import { chatController } from '../controllers/chatController.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Create a more flexible multer instance
const upload = multer({ storage: storage });

// Create router
const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  //console.log('Request URL:', req.url);
  //console.log('Request method:', req.method);
  if (req.headers['content-type']) {
    //console.log('Content-Type:', req.headers['content-type']);
  }
  next();
});

// Define routes
// Check that each controller method exists before using it
if (chatController.sendMessage) {
  router.post('/send', chatController.sendMessage);
} else {
  console.error("Warning: chatController.sendMessage is undefined");
  router.post('/send', (req, res) => res.status(501).json({ error: 'Not implemented' }));
}

// Fix: Change to accept 'file' field name to match frontend
if (chatController.analyzeReports) {
  router.post('/analyze', upload.array('file'), chatController.analyzeReports);
} else {
  console.error("Warning: chatController.analyzeReports is undefined");
  router.post('/analyze', upload.array('file'), (req, res) => res.status(501).json({ error: 'Not implemented' }));
}

if (chatController.generateLetter) {
  router.post('/generate-letter', chatController.generateLetter);
} else {
  console.error("Warning: chatController.generateLetter is undefined");
  router.post('/generate-letter', (req, res) => res.status(501).json({ error: 'Not implemented' }));
}

// Add these new routes for cache management
if (chatController.clearCache) {
  router.get('/manage-cache', (req, res) => {
    const action = req.query.action;
    if (action === 'clear') {
      return chatController.clearCache(req, res);
    } else if (action === 'stats') {
      return chatController.getCacheStats(req, res);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  });
} else {
  console.error("Warning: chatController.clearCache is undefined");
  router.get('/manage-cache', (req, res) => res.status(501).json({ error: 'Not implemented' }));
}

// Export the router
export default router;
