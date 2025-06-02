import multer from 'multer';
import path from 'path';

// Configure multer for memory storage (we'll upload directly to Azure)
const storage = multer.memoryStorage();

// File filter to allow PDF, DOC, and DOCX files
const fileFilter = (req, file, cb) => {
    console.log('📄 File upload attempt:', file.originalname, 'Type:', file.mimetype);
    
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
};

// Create the multer upload instance
export const disputeUpdateUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Export the upload middleware
export default disputeUpdateUpload;
