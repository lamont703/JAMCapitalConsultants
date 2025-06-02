import { BlobServiceClient } from '@azure/storage-blob';
import dotenv from 'dotenv';

dotenv.config();

export class AzureBlobService {
    constructor() {
        this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'jamblobstorage';
        
        if (!this.connectionString) {
            throw new Error('Azure Storage connection string is required');
        }
        
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    }

    async initialize() {
        try {
            // Create container if it doesn't exist
            await this.containerClient.createIfNotExists({
                access: 'blob'
            });
            console.log('✅ Azure Blob Storage initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Azure Blob Storage:', error);
            throw error;
        }
    }

    async uploadFile(file, fileName, metadata = {}) {
        try {
            console.log('📤 Uploading file to Azure Blob Storage:', fileName);
            
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            
            // Upload file with metadata
            const uploadResponse = await blockBlobClient.uploadData(file.buffer, {
                blobHTTPHeaders: {
                    blobContentType: file.mimetype
                },
                metadata: metadata
            });

            console.log('✅ File uploaded successfully:', fileName);
            
            return {
                success: true,
                fileName: fileName,
                url: blockBlobClient.url,
                etag: uploadResponse.etag,
                lastModified: uploadResponse.lastModified
            };

        } catch (error) {
            console.error('❌ Error uploading file to Azure Blob Storage:', error);
            throw error;
        }
    }

    async deleteFile(fileName) {
        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            await blockBlobClient.delete();
            console.log('✅ File deleted successfully:', fileName);
            return true;
        } catch (error) {
            console.error('❌ Error deleting file:', error);
            throw error;
        }
    }

    async getFileUrl(fileName) {
        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            return blockBlobClient.url;
        } catch (error) {
            console.error('❌ Error getting file URL:', error);
            throw error;
        }
    }

    generateFileName(originalName, userEmail, reportType) {
        const timestamp = Date.now();
        const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        const extension = originalName.split('.').pop();
        return `${sanitizedEmail}/${reportType}/${timestamp}_${originalName}`;
    }
}

export default AzureBlobService;
