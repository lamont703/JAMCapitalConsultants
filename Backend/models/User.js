import { CosmosService } from '../services/cosmosService.js';

export class User {
    constructor(userData = {}) {
        this.id = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = 'user';
        this.name = userData.name || '';
        this.email = userData.email ? userData.email.toLowerCase().trim() : '';
        this.password = userData.password || '';
        this.phone = userData.phone ? userData.phone.trim() : '';
        this.company = userData.company ? userData.company.trim() : '';
        this.ghlContactId = userData.ghlContactId || null;
        this.ghlSyncStatus = userData.ghlSyncStatus || 'pending';
        this.createdAt = userData.createdAt || new Date().toISOString();
        this.updatedAt = userData.updatedAt || new Date().toISOString();
        
        // Initialize CosmosService
        this.cosmosService = new CosmosService();
    }

    // Validation methods
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Name is required');
        }
        
        if (!this.email || this.email.trim().length === 0) {
            errors.push('Email is required');
        }
        
        if (!this.isValidEmail(this.email)) {
            errors.push('Invalid email format');
        }
        
        if (!this.password || this.password.length < 6) {
            errors.push('Password must be at least 6 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Instance methods
    async save() {
        try {
            // Validate before saving
            const validation = this.validate();
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Update timestamp
            this.updatedAt = new Date().toISOString();
            
            // Prepare document for CosmosDB
            const document = {
                id: this.id,
                type: this.type,
                name: this.name.trim(),
                email: this.email.toLowerCase().trim(),
                password: this.password,
                phone: this.phone.trim(),
                company: this.company.trim(),
                ghlContactId: this.ghlContactId,
                ghlSyncStatus: this.ghlSyncStatus,
                createdAt: this.createdAt,
                updatedAt: this.updatedAt
            };

            // Save to CosmosDB
            const result = await this.cosmosService.createDocument(document, 'user');
            
            // Update this instance with the saved data
            Object.assign(this, result);
            
            return this;
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        }
    }

    toObject() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            email: this.email,
            password: this.password,
            phone: this.phone,
            company: this.company,
            ghlContactId: this.ghlContactId,
            ghlSyncStatus: this.ghlSyncStatus,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    // Static methods for database operations
    static async findOne(query) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            if (query.email) {
                return await cosmosService.getUserByEmail(query.email);
            }

            // For other queries, build dynamic query
            let sqlQuery = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];

            Object.keys(query).forEach((key, index) => {
                const paramName = `@${key}`;
                sqlQuery += ` AND c.${key} = ${paramName}`;
                parameters.push({ name: paramName, value: query[key] });
            });

            const results = await cosmosService.queryDocuments(sqlQuery, parameters);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error finding user:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            const query = 'SELECT * FROM c WHERE c.id = @id AND c.type = @type';
            const parameters = [
                { name: '@id', value: id },
                { name: '@type', value: 'user' }
            ];

            const results = await cosmosService.queryDocuments(query, parameters);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    static async findByIdAndUpdate(id, updateData) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            // Add updatedAt timestamp
            updateData.updatedAt = new Date().toISOString();

            const result = await cosmosService.updateDocument(id, 'user', updateData);
            return result;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    static async find(query = {}) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            let sqlQuery = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];

            Object.keys(query).forEach((key, index) => {
                const paramName = `@${key}`;
                sqlQuery += ` AND c.${key} = ${paramName}`;
                parameters.push({ name: paramName, value: query[key] });
            });

            return await cosmosService.queryDocuments(sqlQuery, parameters);
        } catch (error) {
            console.error('Error finding users:', error);
            throw error;
        }
    }

    static async deleteOne(query) {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            const user = await this.findOne(query);
            if (user) {
                await cosmosService.deleteDocument(user.id, 'user');
                return { deletedCount: 1 };
            }
            return { deletedCount: 0 };
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }

    // Utility methods for GHL sync
    async updateGHLSyncStatus(status, contactId = null) {
        try {
            const updateData = {
                ghlSyncStatus: status,
                updatedAt: new Date().toISOString()
            };

            if (contactId) {
                updateData.ghlContactId = contactId;
            }

            const result = await User.findByIdAndUpdate(this.id, updateData);
            
            // Update this instance
            this.ghlSyncStatus = status;
            if (contactId) this.ghlContactId = contactId;
            this.updatedAt = updateData.updatedAt;

            return result;
        } catch (error) {
            console.error('Error updating GHL sync status:', error);
            throw error;
        }
    }

    async updateLastLogin() {
        try {
            const cosmosService = new CosmosService();
            await cosmosService.initialize();

            return await cosmosService.updateUserLastLogin(this.id);
        } catch (error) {
            console.error('Error updating last login:', error);
            throw error;
        }
    }
}

// Export both the class and a default export for compatibility
export default User; 