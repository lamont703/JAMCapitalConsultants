import { CosmosDBConfig } from '../config/cosmosConfig.js';

export class CosmosService {
    constructor() {
        this.cosmosConfig = new CosmosDBConfig();
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            await this.cosmosConfig.initialize();
            this.isInitialized = true;
        }
        return this;
    }

    async createDocument(document, partitionKey) {
        try {
            const container = this.cosmosConfig.getContainer();
            const { resource } = await container.items.create(document);
            console.log(`Document created with id: ${resource.id}`);
            return resource;
        } catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    }

    async getDocument(id, partitionKey) {
        try {
            const container = this.cosmosConfig.getContainer();
            const { resource } = await container.item(id, partitionKey).read();
            return resource;
        } catch (error) {
            if (error.code === 404) {
                return null;
            }
            console.error('Error getting document:', error);
            throw error;
        }
    }

    async updateDocument(id, partitionKey, updates) {
        try {
            const container = this.cosmosConfig.getContainer();
            const { resource: existingDoc } = await container.item(id, partitionKey).read();
            
            const updatedDoc = { ...existingDoc, ...updates };
            const { resource } = await container.item(id, partitionKey).replace(updatedDoc);
            
            console.log(`Document updated with id: ${resource.id}`);
            return resource;
        } catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    }

    async deleteDocument(id, partitionKey) {
        try {
            const container = this.cosmosConfig.getContainer();
            await container.item(id, partitionKey).delete();
            console.log(`Document deleted with id: ${id}`);
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }

    async queryDocuments(query, parameters = []) {
        try {
            const container = this.cosmosConfig.getContainer();
            const { resources } = await container.items.query({
                query: query,
                parameters: parameters
            }).fetchAll();
            
            return resources;
        } catch (error) {
            console.error('Error querying documents:', error);
            throw error;
        }
    }

    // Specific methods for your JAM Bot use case
    async saveDisputeAnalysis(userId, analysisData) {
        const document = {
            id: `analysis_${userId}_${Date.now()}`,
            userId: userId,
            type: 'dispute_analysis',
            analysisData: analysisData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return await this.createDocument(document, 'dispute_analysis');
    }

    async getLatestAnalysis(userId) {
        const query = `
            SELECT * FROM c 
            WHERE c.userId = @userId 
            AND c.type = @type 
            ORDER BY c.createdAt DESC 
            OFFSET 0 LIMIT 1
        `;
        
        const parameters = [
            { name: '@userId', value: userId },
            { name: '@type', value: 'dispute_analysis' }
        ];

        const results = await this.queryDocuments(query, parameters);
        return results.length > 0 ? results[0] : null;
    }

    async saveDisputeLetter(userId, letterData) {
        const document = {
            id: `letter_${userId}_${Date.now()}`,
            userId: userId,
            type: 'dispute_letter',
            letterData: letterData,
            createdAt: new Date().toISOString()
        };

        return await this.createDocument(document, 'dispute_letter');
    }

    async getUserDisputeHistory(userId) {
        const query = `
            SELECT * FROM c 
            WHERE c.userId = @userId 
            ORDER BY c.createdAt DESC
        `;
        
        const parameters = [
            { name: '@userId', value: userId }
        ];

        return await this.queryDocuments(query, parameters);
    }

    async createUser(userData) {
        const document = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'user',
            ...userData
        };

        return await this.createDocument(document, 'user');
    }

    async getUserByEmail(email) {
        const query = `
            SELECT * FROM c 
            WHERE c.email = @email 
            AND c.type = @type
        `;
        
        const parameters = [
            { name: '@email', value: email },
            { name: '@type', value: 'user' }
        ];

        const results = await this.queryDocuments(query, parameters);
        return results.length > 0 ? results[0] : null;
    }

    async updateUserLastLogin(userId) {
        const query = `
            SELECT * FROM c 
            WHERE c.id = @userId 
            AND c.type = @type
        `;
        
        const parameters = [
            { name: '@userId', value: userId },
            { name: '@type', value: 'user' }
        ];

        const results = await this.queryDocuments(query, parameters);
        if (results.length > 0) {
            const user = results[0];
            return await this.updateDocument(user.id, 'user', {
                lastLogin: new Date().toISOString()
            });
        }
        return null;
    }

    async logUserActivity(userId, activity, metadata = {}) {
        const document = {
            id: `activity_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: userId,
            type: 'user_activity',
            activity: activity,
            metadata: metadata,
            createdAt: new Date().toISOString()
        };

        return await this.createDocument(document, 'user_activity');
    }

    async getUserByResetToken(resetToken) {
        try {
            await this.ensureInitialized();
            
            const query = {
                query: "SELECT * FROM c WHERE c.type = 'user' AND c.resetToken = @resetToken",
                parameters: [
                    { name: "@resetToken", value: resetToken }
                ]
            };

            const { resources } = await this.container.items.query(query).fetchAll();
            return resources.length > 0 ? resources[0] : null;
        } catch (error) {
            console.error('Error finding user by reset token:', error);
            throw error;
        }
    }
}
