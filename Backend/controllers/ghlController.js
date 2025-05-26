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
    }
}; 