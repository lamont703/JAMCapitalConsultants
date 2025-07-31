export const ghlController = {
    async syncContact(req, res) {
        try {
            const { userData, analysisData } = req.body;
            const ghlService = req.app.locals.ghlService;

            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            // Create contact in GoHighLevel
            const contact = await ghlService.createJAMBotContact(userData, analysisData);

            res.json({
                success: true,
                message: 'Contact synced to GoHighLevel successfully',
                contact: contact
            });

        } catch (error) {
            console.error('Error syncing contact to GHL:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to sync contact to GoHighLevel'
            });
        }
    },

    async testConnection(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const result = await ghlService.ghlConfig.testConnection();
            res.json(result);
            
        } catch (error) {
            console.error('GHL connection test error:', error);
            res.status(500).json({
                success: false,
                error: 'Connection test failed'
            });
        }
    },

    async createContact(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const contactData = req.body;
            const result = await ghlService.createContact(contactData);
            
            res.json({
                success: true,
                contactId: result,
                message: 'Contact created successfully'
            });
            
        } catch (error) {
            console.error('Error creating GHL contact:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create contact'
            });
        }
    },

    async getContact(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            const { contactId } = req.params;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const contact = await ghlService.getContact(contactId);
            res.json({
                success: true,
                contact: contact
            });
            
        } catch (error) {
            console.error('Error fetching GHL contact:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch contact'
            });
        }
    },

    async tokenStatus(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const tokenInfo = await ghlService.getTokenInfo();
            res.json(tokenInfo);
            
        } catch (error) {
            console.error('Error checking token status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to check token status'
            });
        }
    },

    async locationInfo(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const locationInfo = await ghlService.getLocationInfo();
            res.json(locationInfo);
            
        } catch (error) {
            console.error('Error fetching location info:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch location info'
            });
        }
    },

    async rawApiTest(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            const { endpoint, method, data } = req.body;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const result = await ghlService.rawApiCall(endpoint, method, data);
            res.json({
                success: true,
                result: result
            });
            
        } catch (error) {
            console.error('Raw API test error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Raw API call failed'
            });
        }
    },

    async recentContacts(req, res) {
        try {
            const ghlService = req.app.locals.ghlService;
            
            if (!ghlService) {
                return res.status(503).json({
                    success: false,
                    error: 'GoHighLevel service not available'
                });
            }

            const contacts = await ghlService.getRecentContacts();
            res.json({
                success: true,
                contacts: contacts
            });
            
        } catch (error) {
            console.error('Error fetching recent contacts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch recent contacts'
            });
        }
    }
}; 