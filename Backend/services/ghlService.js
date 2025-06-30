import { GoHighLevelConfig } from '../config/ghlConfig.js';

export class GoHighLevelService {
    constructor() {
        this.ghlConfig = new GoHighLevelConfig();
        this.client = null; // Start with null
        this.locationId = this.ghlConfig.getLocationId();
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('🔧 Initializing GoHighLevel service...');
            this.client = await this.ghlConfig.getClient();
            this.isInitialized = true;
            console.log('✅ GoHighLevel service initialized successfully');
            return true;
            
        } catch (error) {
            console.log('⚠️  GoHighLevel service initialization failed - continuing without GHL features');
            this.client = null;
            this.isInitialized = false;
            return false;
        }
    }

    // Ensure client is initialized before any operation
    async ensureInitialized() {
        if (!this.isInitialized || !this.client) {
            await this.initialize();
        }
    }

    // Basic Contact Management
    async createContact(contactData) {
        await this.ensureInitialized();
        
        try {
            const response = await this.client.post(`/contacts/`, {
                ...contactData,
                locationId: this.locationId
            });
            console.log(`Contact created with ID: ${response.data.contact.id}`);
            return response.data;
        } catch (error) {
            console.error('Error creating contact:', error.response?.data || error.message);
            throw error;
        }
    }

    async getContact(contactId) {
        await this.ensureInitialized();
        
        try {
            const response = await this.client.get(`/contacts/${contactId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching contact:', error.response?.data || error.message);
            throw error;
        }
    }

    async searchContacts(searchParams) {
        await this.ensureInitialized();
        
        try {
            const response = await this.client.get('/contacts/', {
                params: {
                    locationId: this.locationId,
                    ...searchParams
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error searching contacts:', error.response?.data || error.message);
            throw error;
        }
    }

    // JAM Bot specific method
    async createJAMBotContact(userData, analysisData) {
        const contactData = {
            firstName: userData.name?.split(' ')[0] || '',
            lastName: userData.name?.split(' ').slice(1).join(' ') || '',
            email: userData.email,
            phone: userData.phone,
            source: 'JAM Bot',
            tags: ['JAM Bot Lead', 'Credit Analysis']
        };

        return await this.createContact(contactData);
    }

    async findContactByEmail(email) {
        console.log('🔍 Searching for existing contact:', email);
        
        await this.ensureInitialized();
        
        try {
            const response = await this.client.post('/contacts/search', {
                locationId: this.ghlConfig.getLocationId(),
                pageLimit: 20,
                page: 1,
                filters: [
                    {
                        field: 'email',
                        operator: 'eq',
                        value: email
                    }
                ]
            });
            
            const contact = response.data.contacts?.find(contact => 
                contact.email?.toLowerCase() === email.toLowerCase()
            );
            
            console.log('🔍 Contact search result:', contact ? `Found: ${contact.id}` : 'Not found');
            return contact;
        } catch (error) {
            console.error('❌ Failed to search contacts:', error.response?.data || error.message);
            return null;
        }
    }

    async createContactFromRegistration(userData) {
        console.log('🔄 Creating GHL contact for:', userData.email);
        
        await this.ensureInitialized();
        
        try {
            const contactData = {
                firstName: userData.firstName || userData.name?.split(' ')[0] || '',
                lastName: userData.lastName || userData.name?.split(' ').slice(1).join(' ') || '',
                name: userData.name || '',
                email: userData.email,
                phone: userData.phone || '',
                locationId: this.ghlConfig.getLocationId(),
                source: 'JAM Capital Website Registration',
                tags: ['Website Lead', 'New Registration'],
                customFields: [
                    {
                        key: 'registration_date',
                        field_value: new Date().toISOString()
                    },
                    {
                        key: 'user_id',
                        field_value: userData.id || userData._id || ''
                    },
                    {
                        key: 'registration_source',
                        field_value: 'login_form'
                    }
                ]
            };

            if (userData.company) contactData.companyName = userData.company;

            console.log('📤 Sending contact data to GHL:', JSON.stringify(contactData, null, 2));

            const response = await this.client.post('/contacts/', contactData);

            console.log('📥 GHL Response:', JSON.stringify(response.data, null, 2));
            console.log(`✅ Contact created in GHL: ${contactData.email} (ID: ${response.data.contact.id})`);
            
            return {
                success: true,
                ghlContactId: response.data.contact.id,
                contact: response.data.contact
            };

        } catch (error) {
            console.error('❌ Failed to create GHL contact:', error.response?.data || error.message);
            console.error('❌ Full error:', error);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async testConnection() {
        return await this.ghlConfig.testConnection();
    }

    // ===== SUBSCRIPTION MANAGEMENT METHODS =====

    /**
     * Cancel a subscription in GoHighLevel
     * @param {string} subscriptionId - GHL subscription ID
     * @param {string} reason - Cancellation reason
     * @returns {Object} Cancellation result
     */
    async cancelSubscription(subscriptionId, reason = 'user_requested') {
        await this.ensureInitialized();
        
        if (!this.client) {
            console.log('⚠️ GHL client not available - skipping GHL cancellation');
            return {
                success: false,
                error: 'GHL client not available',
                localOnly: true
            };
        }

        try {
            console.log(`🔄 Cancelling GHL subscription: ${subscriptionId}, reason: ${reason}`);
            
            // GHL API endpoint for subscription cancellation
            const response = await this.client.delete(`/payments/subscriptions/${subscriptionId}`, {
                data: {
                    cancellationReason: reason,
                    cancellationType: 'end_of_period' // or 'immediate'
                }
            });

            console.log(`✅ Successfully cancelled GHL subscription: ${subscriptionId}`);
            
            return {
                success: true,
                subscriptionId: subscriptionId,
                cancellationData: response.data,
                ghlResponse: response.data
            };

        } catch (error) {
            console.error('❌ Error cancelling GHL subscription:', error.response?.data || error.message);
            
            // If it's a 404, the subscription might already be cancelled
            if (error.response?.status === 404) {
                console.log('📝 Subscription not found in GHL - may already be cancelled');
                return {
                    success: true,
                    subscriptionId: subscriptionId,
                    warning: 'Subscription not found in GHL - may already be cancelled'
                };
            }
            
            return {
                success: false,
                error: error.response?.data || error.message,
                subscriptionId: subscriptionId
            };
        }
    }

    /**
     * Pause a subscription in GoHighLevel
     * @param {string} subscriptionId - GHL subscription ID  
     * @param {number} pauseDurationMonths - How many months to pause
     * @returns {Object} Pause result
     */
    async pauseSubscription(subscriptionId, pauseDurationMonths = 3) {
        await this.ensureInitialized();
        
        if (!this.client) {
            console.log('⚠️ GHL client not available - skipping GHL pause');
            return {
                success: false,
                error: 'GHL client not available',
                localOnly: true
            };
        }

        try {
            console.log(`⏸️ Pausing GHL subscription: ${subscriptionId} for ${pauseDurationMonths} months`);
            
            // Calculate pause end date
            const pauseEndDate = new Date();
            pauseEndDate.setMonth(pauseEndDate.getMonth() + pauseDurationMonths);
            
            // GHL API endpoint for subscription pause
            const response = await this.client.put(`/payments/subscriptions/${subscriptionId}/pause`, {
                pauseUntil: pauseEndDate.toISOString(),
                pauseDurationMonths: pauseDurationMonths
            });

            console.log(`✅ Successfully paused GHL subscription: ${subscriptionId}`);
            
            return {
                success: true,
                subscriptionId: subscriptionId,
                pauseUntil: pauseEndDate.toISOString(),
                pauseData: response.data,
                ghlResponse: response.data
            };

        } catch (error) {
            console.error('❌ Error pausing GHL subscription:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message,
                subscriptionId: subscriptionId
            };
        }
    }

    /**
     * Get subscription details from GoHighLevel
     * @param {string} subscriptionId - GHL subscription ID
     * @returns {Object} Subscription details
     */
    async getSubscription(subscriptionId) {
        await this.ensureInitialized();
        
        if (!this.client) {
            return {
                success: false,
                error: 'GHL client not available'
            };
        }

        try {
            const response = await this.client.get(`/payments/subscriptions/${subscriptionId}`);
            
            return {
                success: true,
                subscription: response.data
            };

        } catch (error) {
            console.error('❌ Error fetching GHL subscription:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Find subscription by contact email
     * @param {string} email - Contact email
     * @returns {Object} Subscription search result
     */
    async findSubscriptionByEmail(email) {
        await this.ensureInitialized();
        
        if (!this.client) {
            return {
                success: false,
                error: 'GHL client not available'
            };
        }

        try {
            // First find the contact
            const contact = await this.findContactByEmail(email);
            
            if (!contact) {
                console.log(`📝 Contact not found for email: ${email}`);
                return {
                    success: false,
                    error: 'Contact not found'
                };
            }

            console.log(`🔍 Found contact: ${contact.id}, searching for subscriptions...`);

            // Then search for subscriptions for this contact with required altId and altType
            const response = await this.client.get('/payments/subscriptions/', {
                params: {
                    contactId: contact.id,
                    altId: this.locationId,
                    altType: 'location'
                }
            });

            const activeSubscriptions = response.data.subscriptions?.filter(
                sub => sub.status === 'active' || sub.status === 'trialing'
            ) || [];

            console.log(`📊 Found ${activeSubscriptions.length} active subscriptions for contact`);

            return {
                success: true,
                subscriptions: activeSubscriptions,
                contact: contact
            };

        } catch (error) {
            console.error('❌ Error finding subscription by email:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    // ===== DEPRECATED: PIPELINE METHODS REMOVED =====
    // Pipeline automation has been replaced with tag-based automation
    // GoHighLevel now handles automation workflows internally based on tags

    // ===== TAG MANAGEMENT METHODS =====

    /**
     * Add tags to a contact
     * @param {string} contactId - Contact ID
     * @param {Array|string} tags - Tag(s) to add
     * @returns {Object} Result of tag addition
     */
    async addTagsToContact(contactId, tags) {
        await this.ensureInitialized();
        
        if (!this.client) {
            return {
                success: false,
                error: 'GHL client not available'
            };
        }

        try {
            // Ensure tags is an array
            const tagArray = Array.isArray(tags) ? tags : [tags];
            
            console.log(`🏷️ Adding tags to contact ${contactId}:`, tagArray);
            
            const response = await this.client.post(`/contacts/${contactId}/tags`, {
                tags: tagArray
            });

            console.log(`✅ Tags added successfully`);
            
            return {
                success: true,
                tags: tagArray,
                contact: response.data.contact
            };

        } catch (error) {
            console.error('❌ Error adding tags:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Remove tags from a contact
     * @param {string} contactId - Contact ID
     * @param {Array|string} tags - Tag(s) to remove
     * @returns {Object} Result of tag removal
     */
    async removeTagsFromContact(contactId, tags) {
        await this.ensureInitialized();
        
        if (!this.client) {
            return {
                success: false,
                error: 'GHL client not available'
            };
        }

        try {
            // Ensure tags is an array
            const tagArray = Array.isArray(tags) ? tags : [tags];
            
            console.log(`🏷️ Removing tags from contact ${contactId}:`, tagArray);
            
            const response = await this.client.delete(`/contacts/${contactId}/tags`, {
                data: {
                    tags: tagArray
                }
            });

            console.log(`✅ Tags removed successfully`);
            
            return {
                success: true,
                tags: tagArray,
                contact: response.data.contact
            };

        } catch (error) {
            console.error('❌ Error removing tags:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Get all tags for a contact
     * @param {string} contactId - Contact ID
     * @returns {Array} Array of tags
     */
    async getContactTags(contactId) {
        await this.ensureInitialized();
        
        if (!this.client) {
            throw new Error('GHL client not available');
        }

        try {
            console.log(`🔍 Getting tags for contact: ${contactId}`);
            
            const response = await this.client.get(`/contacts/${contactId}`);
            const contact = response.data.contact;
            const tags = contact.tags || [];
            
            console.log(`📊 Found ${tags.length} tags for contact`);
            return tags;

        } catch (error) {
            console.error('❌ Error getting contact tags:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Replace all tags for a contact (removes existing, adds new)
     * @param {string} contactId - Contact ID
     * @param {Array} newTags - New tags to set
     * @returns {Object} Result of tag replacement
     */
    async replaceContactTags(contactId, newTags) {
        await this.ensureInitialized();
        
        if (!this.client) {
            return {
                success: false,
                error: 'GHL client not available'
            };
        }

        try {
            console.log(`🔄 Replacing tags for contact ${contactId}`);
            console.log(`New tags:`, newTags);
            
            // Get current tags
            const currentTags = await this.getContactTags(contactId);
            console.log(`Current tags:`, currentTags);
            
            // Remove old tags if any exist
            if (currentTags.length > 0) {
                await this.removeTagsFromContact(contactId, currentTags);
            }
            
            // Add new tags
            if (newTags.length > 0) {
                const result = await this.addTagsToContact(contactId, newTags);
                return result;
            }
            
            return {
                success: true,
                tags: newTags
            };

        } catch (error) {
            console.error('❌ Error replacing contact tags:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Generate credential status tags based on completion state
     * @param {Object} credentialStatus - Status of each credential service
     * @returns {Array} Array of tags to apply
     */
    generateCredentialTags(credentialStatus) {
        const tags = [];
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Count completed credentials
        const completedCount = Object.values(credentialStatus).filter(Boolean).length;
        
        // Progress tag
        tags.push(`Credentials: ${completedCount}/3`);
        
        // Individual service tags
        if (credentialStatus.smartcredit) tags.push('SmartCredit Complete');
        if (credentialStatus.identityiq) tags.push('IdentityIQ Complete');
        if (credentialStatus.myscoreiq) tags.push('MyScoreIQ Complete');
        
        // Status tags
        if (completedCount === 3) {
            tags.push('Ready for Consultation');
            tags.push('AUTO: Consultation Staging');
        } else if (completedCount > 0) {
            tags.push('Credentials In Progress');
        }
        
        // Date tracking
        tags.push(`Updated: ${dateStr}`);
        
        return tags;
    }

    /**
     * Update contact with credential completion tags
     * @param {string} contactId - Contact ID
     * @param {Object} credentialStatus - Status of each credential service
     * @returns {Object} Result of tag update
     */
    async updateCredentialTags(contactId, credentialStatus) {
        console.log('🏷️ Updating credential tags for contact:', contactId);
        
        try {
            const newTags = this.generateCredentialTags(credentialStatus);
            
            // Replace all existing tags with the new credential tags
            const result = await this.replaceContactTags(contactId, newTags);
            
            console.log(`✅ Updated credential tags for contact ${contactId}:`, newTags);
            return {
                success: true,
                tags: newTags,
                result: result
            };
            
        } catch (error) {
            console.error('❌ Failed to update credential tags:', error);
            return {
                success: false,
                error: error.message,
                tags: []
            };
        }
    }

    // ===== DEBUG AND TESTING METHODS =====

    async getTokenInfo() {
        try {
            const tokenInfo = await this.ghlConfig.tokenService.getTokenInfo();
            return {
                success: true,
                tokenInfo: tokenInfo
            };
        } catch (error) {
            console.error('Error getting token info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getLocationInfo() {
        await this.ensureInitialized();
        
        try {
            const response = await this.client.get(`/locations/${this.locationId}`);
            return {
                success: true,
                location: {
                    id: response.data.location.id,
                    name: response.data.location.name,
                    address: response.data.location.address,
                    city: response.data.location.city,
                    state: response.data.location.state,
                    country: response.data.location.country,
                    timezone: response.data.location.timezone
                }
            };
        } catch (error) {
            console.error('Error getting location info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async rawApiCall(endpoint, method = 'GET', data = null) {
        await this.ensureInitialized();
        
        try {
            let response;
            const config = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            switch (method.toUpperCase()) {
                case 'GET':
                    response = await this.client.get(`/${endpoint}`, config);
                    break;
                case 'POST':
                    response = await this.client.post(`/${endpoint}`, data, config);
                    break;
                case 'PUT':
                    response = await this.client.put(`/${endpoint}`, data, config);
                    break;
                case 'DELETE':
                    response = await this.client.delete(`/${endpoint}`, config);
                    break;
                default:
                    throw new Error(`Unsupported method: ${method}`);
            }

            return {
                success: true,
                status: response.status,
                data: response.data,
                headers: response.headers
            };
        } catch (error) {
            console.error('Raw API call error:', error);
            return {
                success: false,
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            };
        }
    }

    async getRecentContacts(limit = 10) {
        await this.ensureInitialized();
        
        try {
            const response = await this.client.get('/contacts/', {
                params: {
                    locationId: this.locationId,
                    limit: limit,
                    sortBy: 'date_created',
                    sortOrder: 'desc'
                }
            });

            return {
                success: true,
                contacts: response.data.contacts || [],
                totalCount: response.data.totalCount || 0
            };
        } catch (error) {
            console.error('Error getting recent contacts:', error);
            return {
                success: false,
                error: error.message,
                contacts: []
            };
        }
    }
} 