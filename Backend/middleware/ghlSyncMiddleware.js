export const ghlSyncMiddleware = {
    // Helper function to safely check if an error contains specific text
    isJWTError(error) {
        const errorStr = typeof error === 'string' ? error : (error?.message || error?.toString() || '');
        return errorStr.includes('Invalid JWT') || 
               errorStr.includes('401') || 
               errorStr.includes('unauthorized') ||
               errorStr.includes('invalid_grant');
    },

    async syncNewUser(userData, ghlService = null) {
        console.log('🔍 GHL Sync Middleware - Starting sync for:', userData.email);
        
        // 🎯 RETRY LOGIC FOR JWT FAILURES
        const maxRetries = 2;
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                attempt++;
                console.log(`🔄 Sync attempt ${attempt}/${maxRetries} for ${userData.email}`);
                
                // Check if GHL service is available (passed as parameter or from global)
                let service = ghlService || global.ghlService || null;
                console.log('🔍 GHL Service available:', !!service);
                
                if (!service) {
                    console.log('❌ GHL service not available - attempting to create new instance...');
                    
                    // Try to create a new GHL service instance as fallback
                    try {
                        const { GoHighLevelService } = await import('../services/ghlService.js');
                        const newService = new GoHighLevelService();
                        const initialized = await newService.initialize();
                        
                        if (initialized) {
                            console.log('✅ Created new GHL service instance for sync');
                            service = newService;
                            // Set it globally for future requests
                            global.ghlService = newService;
                        } else {
                            console.log('❌ Failed to create new GHL service instance');
                            return {
                                success: false,
                                error: 'GoHighLevel service not initialized'
                            };
                        }
                    } catch (error) {
                        console.log('❌ Error creating new GHL service:', error.message);
                        return {
                            success: false,
                            error: 'GoHighLevel service not initialized'
                        };
                    }
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
                    return {
                        success: true,
                        action: 'created',
                        ghlContactId: result.ghlContactId,
                        contact: result.contact
                    };
                } else {
                    // Check if error is JWT-related
                    if (result.error && this.isJWTError(result.error)) {
                        console.log(`⚠️ JWT authentication error on attempt ${attempt}: ${result.error}`);
                        
                        if (attempt < maxRetries) {
                            console.log('🔄 Attempting to refresh token and retry...');
                            await service.initialize(); // Force token refresh
                            continue; // Retry the sync
                        }
                    }
                    
                    console.log(`❌ Failed to sync user to GHL: ${userData.email} - ${result.error}`);
                    return {
                        success: false,
                        error: result.error
                    };
                }
                
            } catch (error) {
                console.error(`❌ Exception during sync attempt ${attempt}:`, error);
                
                // Check if error is JWT-related
                if (this.isJWTError(error)) {
                    console.log(`⚠️ JWT authentication exception on attempt ${attempt}: ${error.message || error}`);
                    
                    if (attempt < maxRetries) {
                        console.log('🔄 Attempting to refresh token and retry...');
                        try {
                            let service = ghlService || global.ghlService || null;
                            if (service) {
                                await service.initialize(); // Force token refresh
                            }
                        } catch (refreshError) {
                            console.error('❌ Token refresh failed:', refreshError.message);
                        }
                        continue; // Retry the sync
                    }
                }
                
                // For non-JWT errors or final attempt, return the error
                return {
                    success: false,
                    error: error.message
                };
            }
        }
        
        // If we get here, all retries failed
        return {
            success: false,
            error: `Failed to sync after ${maxRetries} attempts - likely authentication issue`
        };
    }
}; 