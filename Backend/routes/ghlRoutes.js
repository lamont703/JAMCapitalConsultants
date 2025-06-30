import express from 'express';
import { ghlController } from '../controllers/ghlController.js';

const router = express.Router();

router.post('/sync-contact', ghlController.syncContact);
router.get('/test-connection', ghlController.testConnection);
router.post('/create-contact', ghlController.createContact);
router.get('/get-contact/:contactId', ghlController.getContact);
router.get('/token-status', ghlController.tokenStatus);
router.get('/location-info', ghlController.locationInfo);
router.post('/raw-api-test', ghlController.rawApiTest);
router.get('/recent-contacts', ghlController.recentContacts);

export default router;