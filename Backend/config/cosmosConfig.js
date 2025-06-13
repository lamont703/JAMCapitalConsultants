import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';

dotenv.config();

export class CosmosDBConfig {
    constructor() {
        // Try to get connection string first, then fallback to individual endpoint/key
        const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
        
        if (connectionString) {
            // Parse connection string
            const endpointMatch = connectionString.match(/AccountEndpoint=([^;]+)/);
            const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
            
            this.endpoint = endpointMatch ? endpointMatch[1] : null;
            this.key = keyMatch ? keyMatch[1] : null;
        } else {
            // Fallback to individual environment variables
            this.endpoint = process.env.COSMOS_ENDPOINT;
            this.key = process.env.COSMOS_KEY;
        }
        
        this.databaseId = process.env.COSMOS_DB_DATABASE_NAME || process.env.COSMOS_DATABASE_NAME || 'jamdb';
        this.containerId = process.env.COSMOS_DB_CONTAINER_NAME || process.env.COSMOS_CONTAINER_NAME || 'jamdbcontainer';
        
        if (!this.endpoint || !this.key) {
            throw new Error('CosmosDB endpoint and key must be provided in environment variables (COSMOS_DB_CONNECTION_STRING or COSMOS_ENDPOINT/COSMOS_KEY)');
        }

        this.client = new CosmosClient({
            endpoint: this.endpoint,
            key: this.key,
            connectionPolicy: {
                requestTimeout: process.env.COSMOS_CONNECTION_POLICY_REQUEST_TIMEOUT || 60000,
                enableEndpointDiscovery: process.env.COSMOS_CONNECTION_POLICY_ENABLE_ENDPOINT_DISCOVERY === 'true'
            }
        });

        this.database = null;
        this.container = null;
    }

    async initialize() {
        try {
            console.log('Initializing CosmosDB connection...');
            
            // Create database if it doesn't exist
            const { database } = await this.client.databases.createIfNotExists({
                id: this.databaseId
            });
            this.database = database;
            console.log(`Database '${this.databaseId}' ready`);

            // Create container if it doesn't exist
            const { container } = await this.database.containers.createIfNotExists({
                id: this.containerId,
                partitionKey: {
                    paths: ['/type'],
                    kind: 'Hash'
                },
                indexingPolicy: {
                    automatic: true,
                    indexingMode: 'consistent',
                    includedPaths: [
                        {
                            path: '/*'
                        }
                    ],
                    excludedPaths: [
                        {
                            path: '/"_etag"/?'
                        }
                    ]
                }
            });
            this.container = container;
            console.log(`Container '${this.containerId}' ready`);

            return true;
        } catch (error) {
            console.error('Error initializing CosmosDB:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.client.getDatabaseAccount();
            console.log('CosmosDB connection test successful');
            return true;
        } catch (error) {
            console.error('CosmosDB connection test failed:', error);
            return false;
        }
    }

    getClient() {
        return this.client;
    }

    getDatabase() {
        return this.database;
    }

    getContainer() {
        return this.container;
    }
}
