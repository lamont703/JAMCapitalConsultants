import express from 'express';
import multer from 'multer';
import { chatController } from '../controllers/chatController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only PDFs and images
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, and PNG files are allowed'));
    }
  }
});

// Chat endpoint
router.post('/chat', chatController.handleChatMessage);

// Report analysis endpoint
router.post('/analyzeReports', upload.array('file', 5), chatController.analyzeReports);

// New route for dispute letter generation
router.post('/generateDisputeLetters', chatController.generateDisputeLetters);

export { router as chatRoutes };
