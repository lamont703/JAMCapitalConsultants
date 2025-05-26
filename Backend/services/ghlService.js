import { GoHighLevelConfig } from '../config/ghlConfig.js';

export class GoHighLevelService {
    constructor() {
        this.ghlConfig = new GoHighLevelConfig();
        this.client = this.ghlConfig.getClient();
        this.locationId = this.ghlConfig.getLocationId();
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            const testResult = await this.ghlConfig.testConnection();
            if (!testResult.success) {
                throw new Error(`GoHighLevel initialization failed: ${testResult.error}`);
            }
            this.isInitialized = true;
            console.log('GoHighLevel service initialized successfully');
        }
        return this.isInitialized;
    }

    // Basic Contact Management
    async createContact(contactData) {
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
        try {
            const response = await this.client.get(`/contacts/${contactId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching contact:', error.response?.data || error.message);
            throw error;
        }
    }

    async searchContacts(searchParams) {
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
} 