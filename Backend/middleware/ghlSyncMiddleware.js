export const ghlSyncMiddleware = {
    async syncNewUser(userData, ghlService = null) {
        console.log('🔍 GHL Sync Middleware - Starting sync for:', userData.email);
        
        try {
            // Check if GHL service is available (passed as parameter or from global)
            let service = ghlService || global.ghlService || null;
            console.log('🔍 GHL Service available:', !!service);
            
            if (!service) {
                console.log('❌ GHL service not available');
                return {
                    success: false,
                    error: 'GoHighLevel service not initialized'
                };
            }

            console.log('🔍 Checking if contact already exists in GHL...');
            // Check if contact already exists
            const existingContact = await service.findContactByEmail(userData.email);
            
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
            const result = await service.createContactFromRegistration(userData);
            
            if (result.success) {
                console.log(`✅ New user synced to GHL: ${userData.email} (Contact ID: ${result.ghlContactId})`);
                return result;
            } else {
                // Check if this is a duplicate contact error
                if (result.error && result.error.statusCode === 400 && 
                    result.error.message && result.error.message.includes('This location does not allow duplicated contacts') &&
                    result.error.meta && result.error.meta.contactId) {
                    
                    console.log(`🔄 Duplicate contact detected, using existing contact ID: ${result.error.meta.contactId}`);
                    console.log(`📋 Matching field: ${result.error.meta.matchingField}`);
                    
                    return {
                        success: true,
                        action: 'duplicate_resolved',
                        ghlContactId: result.error.meta.contactId,
                        matchingField: result.error.meta.matchingField
                    };
                }
                
                // Other errors
                console.log(`❌ GHL sync failed for: ${userData.email}`, result.error);
                return result;
            }

        } catch (error) {
            console.error('❌ GHL sync middleware error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}; 