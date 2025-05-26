import express from 'express';
import { ghlController } from '../controllers/ghlController.js';

const router = express.Router();

router.post('/sync-contact', ghlController.syncContact);
router.get('/test-connection', ghlController.testConnection);

export default router;