import { GoHighLevelConfig } from '../config/ghlConfig.js';

export class GoHighLevelService {
    constructor() {
        this.ghlConfig = new GoHighLevelConfig();
        this.client = null; // Start with null
        this.locationId = this.ghlConfig.getLocationId();
        this.isInitialized = false;
    }

    async initialize() {
        console.log('🔄 Initializing GHL Service...');
        try {
            this.client = await this.ghlConfig.getClient(); // Properly await the client
            this.isInitialized = true;
            console.log('✅ GHL Client initialized');
            console.log('🔍 Client type:', typeof this.client);
            console.log('🔍 Client has post method:', typeof this.client?.post);
            return this.client;
        } catch (error) {
            console.error('❌ Failed to initialize GHL client:', error);
            throw error;
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
} 