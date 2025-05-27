export const ghlSyncMiddleware = {
    async syncNewUser(userData) {
        console.log('🔍 GHL Sync Middleware - Starting sync for:', userData.email);
        
        try {
            // Check if GHL service is available
            const ghlService = global.ghlService || null;
            console.log('🔍 GHL Service available:', !!ghlService);
            
            if (!ghlService) {
                console.log('❌ GHL service not available - checking app.locals...');
                // Try to get from app.locals if available
                return {
                    success: false,
                    error: 'GoHighLevel service not initialized'
                };
            }

            console.log('🔍 Checking if contact already exists in GHL...');
            // Check if contact already exists
            const existingContact = await ghlService.findContactByEmail(userData.email);
            
            if (existingContact) {
                console.log(`📋 Contact already exists in GHL: ${userData.email} (ID: ${existingContact.id})`);
                return {
                    success: true,
                    action: 'existing',
                    ghlContactId: existingContact.id
                };
            }

            console.log('🆕 Creating new contact in GHL...');
            // Create new contact
            const result = await ghlService.createContactFromRegistration(userData);
            
            if (result.success) {
                console.log(`✅ New user synced to GHL: ${userData.email} (Contact ID: ${result.ghlContactId})`);
            } else {
                console.log(`❌ GHL sync failed for: ${userData.email}`, result.error);
            }
            
            return result;

        } catch (error) {
            console.error('❌ GHL sync middleware error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}; 