import { BlobServiceClient } from '@azure/storage-blob';
import dotenv from 'dotenv';

dotenv.config();

export class AzureBlobService {
    constructor() {
        this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'jam-uploads';
        
        if (!this.connectionString) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Azure Storage connection string is required in production');
            } else {
                console.warn('⚠️  Azure Storage connection string not configured - file uploads will be disabled');
                return;
            }
        }
        
        try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
            console.log('✅ Azure Blob Service client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Azure Blob Service client:', error);
            throw error;
        }
    }

    async initialize() {
        if (!this.connectionString) {
            console.log('⚠️  Skipping Azure Blob Storage initialization - no connection string');
            return false;
        }

        try {
            console.log(`🔄 Initializing Azure Blob Storage container: ${this.containerName}`);
            
            // Create container if it doesn't exist with retry logic
            const maxRetries = 3;
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                try {
                    const createResponse = await this.containerClient.createIfNotExists({
                        access: 'container' // Changed from 'blob' to 'container' for better access
            });
                    
                    if (createResponse.succeeded) {
                        console.log(`✅ Created new container: ${this.containerName}`);
                    } else {
                        console.log(`✅ Container already exists: ${this.containerName}`);
                    }
                    
                    // Verify container exists and is accessible
                    const containerExists = await this.containerClient.exists();
                    if (!containerExists) {
                        throw new Error('Container verification failed after creation');
                    }
                    
            console.log('✅ Azure Blob Storage initialized successfully');
                    return true;
                    
                } catch (error) {
                    retryCount++;
                    console.warn(`⚠️  Azure Blob Storage initialization attempt ${retryCount} failed:`, error.message);
                    
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Azure Blob Storage:', error);
            
            if (process.env.NODE_ENV === 'production') {
            throw error;
            } else {
                console.log('⚠️  Continuing without Azure Blob Storage in development mode');
                return false;
            }
        }
    }

    async uploadFile(file, fileName, metadata = {}) {
        if (!this.containerClient) {
            throw new Error('Azure Blob Storage not initialized');
        }

        try {
            console.log('📤 Uploading file to Azure Blob Storage:', fileName);
            
            // Validate file
            if (!file || !file.buffer) {
                throw new Error('Invalid file object - missing buffer');
            }
            
            if (!fileName || fileName.trim() === '') {
                throw new Error('Invalid filename provided');
            }
            
            // Sanitize filename for Azure blob storage
            const sanitizedFileName = this.sanitizeFileName(fileName);
            
            const blockBlobClient = this.containerClient.getBlockBlobClient(sanitizedFileName);
            
            // Enhanced metadata
            const enhancedMetadata = {
                uploadedAt: new Date().toISOString(),
                originalName: fileName,
                fileSize: file.buffer.length.toString(),
                environment: process.env.NODE_ENV || 'development',
                ...metadata
            };
            
            // Upload with retry logic
            const maxRetries = 3;
            let retryCount = 0;
            let uploadResponse;
            
            while (retryCount < maxRetries) {
                try {
                    // Upload file with metadata and content type
                    uploadResponse = await blockBlobClient.uploadData(file.buffer, {
                blobHTTPHeaders: {
                            blobContentType: file.mimetype || 'application/octet-stream',
                            blobCacheControl: 'public, max-age=31536000', // 1 year cache
                            blobContentDisposition: `attachment; filename="${fileName}"`
                },
                        metadata: enhancedMetadata,
                        tier: 'Hot', // Use Hot tier for frequently accessed files
                        tags: {
                            environment: process.env.NODE_ENV || 'development',
                            uploadDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
                        }
                    });
                    
                    break; // Success, exit retry loop
                    
                } catch (error) {
                    retryCount++;
                    console.warn(`⚠️  Upload attempt ${retryCount} failed for ${sanitizedFileName}:`, error.message);
                    
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                }
            }

            console.log('✅ File uploaded successfully:', sanitizedFileName);
            
            return {
                success: true,
                fileName: sanitizedFileName,
                originalName: fileName,
                url: blockBlobClient.url,
                etag: uploadResponse.etag,
                lastModified: uploadResponse.lastModified,
                size: file.buffer.length,
                contentType: file.mimetype,
                metadata: enhancedMetadata
            };

        } catch (error) {
            console.error('❌ Error uploading file to Azure Blob Storage:', error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }

    async downloadFile(fileName) {
        if (!this.containerClient) {
            throw new Error('Azure Blob Storage not initialized');
        }

        try {
            console.log('📥 Downloading file from Azure Blob Storage:', fileName);
            
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            
            // Check if blob exists
            const exists = await blockBlobClient.exists();
            if (!exists) {
                throw new Error(`File not found: ${fileName}`);
            }
            
            // Download blob
            const downloadResponse = await blockBlobClient.download();
            
            return {
                success: true,
                fileName: fileName,
                readableStreamBody: downloadResponse.readableStreamBody,
                contentType: downloadResponse.contentType,
                contentLength: downloadResponse.contentLength,
                metadata: downloadResponse.metadata
            };
            
        } catch (error) {
            console.error('❌ Error downloading file from Azure Blob Storage:', error);
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    async deleteFile(fileName) {
        if (!this.containerClient) {
            throw new Error('Azure Blob Storage not initialized');
        }

        try {
            console.log('🗑️  Deleting file from Azure Blob Storage:', fileName);
            
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            
            // Check if blob exists before attempting to delete
            const exists = await blockBlobClient.exists();
            if (!exists) {
                console.log(`ℹ️  File already does not exist: ${fileName}`);
                return true;
            }
            
            await blockBlobClient.delete({
                deleteSnapshots: 'include' // Delete any snapshots as well
            });
            
            console.log('✅ File deleted successfully:', fileName);
            return true;
        } catch (error) {
            console.error('❌ Error deleting file from Azure Blob Storage:', error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    async getFileUrl(fileName, expiresInMinutes = 60) {
        if (!this.containerClient) {
            throw new Error('Azure Blob Storage not initialized');
        }

        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
            
            // Check if blob exists
            const exists = await blockBlobClient.exists();
            if (!exists) {
                throw new Error(`File not found: ${fileName}`);
            }
            
            // For public containers, return the direct URL
            if (process.env.AZURE_STORAGE_PUBLIC_ACCESS === 'true') {
            return blockBlobClient.url;
            }
            
            // Generate SAS URL for private access
            const sasUrl = await blockBlobClient.generateSasUrl({
                permissions: 'r', // Read permission
                expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000)
            });
            
            return sasUrl;
            
        } catch (error) {
            console.error('❌ Error getting file URL:', error);
            throw new Error(`Failed to get file URL: ${error.message}`);
        }
    }

    async listFiles(prefix = '', maxResults = 100) {
        if (!this.containerClient) {
            throw new Error('Azure Blob Storage not initialized');
        }

        try {
            console.log(`📋 Listing files from Azure Blob Storage with prefix: ${prefix}`);
            
            const files = [];
            const options = {
                prefix: prefix,
                includeMetadata: true,
                includeTags: true
            };
            
            let count = 0;
            for await (const blob of this.containerClient.listBlobsFlat(options)) {
                if (count >= maxResults) break;
                
                files.push({
                    name: blob.name,
                    size: blob.properties.contentLength,
                    contentType: blob.properties.contentType,
                    lastModified: blob.properties.lastModified,
                    etag: blob.properties.etag,
                    metadata: blob.metadata,
                    tags: blob.tags
                });
                
                count++;
            }
            
            console.log(`✅ Listed ${files.length} files`);
            return files;
            
        } catch (error) {
            console.error('❌ Error listing files:', error);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    generateFileName(originalName, userEmail, category = 'general') {
        const timestamp = Date.now();
        const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
        const extension = originalName.split('.').pop() || 'txt';
        const baseName = originalName.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9]/g, '_');
        
        return `${sanitizedEmail}/${category}/${timestamp}_${baseName}.${extension}`;
    }

    sanitizeFileName(fileName) {
        // Remove or replace characters that aren't allowed in Azure blob names
        return fileName
            .replace(/[<>:"/\\|?*]/g, '_') // Replace forbidden characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_{2,}/g, '_') // Replace multiple underscores with single
            .toLowerCase(); // Convert to lowercase for consistency
    }

    async getStorageStats() {
        if (!this.containerClient) {
            return { error: 'Azure Blob Storage not initialized' };
        }

        try {
            const stats = {
                containerName: this.containerName,
                totalFiles: 0,
                totalSize: 0,
                lastUpdated: new Date().toISOString()
            };

            // Count files and calculate total size
            for await (const blob of this.containerClient.listBlobsFlat({ includeMetadata: true })) {
                stats.totalFiles++;
                stats.totalSize += blob.properties.contentLength || 0;
            }

            return stats;
        } catch (error) {
            console.error('❌ Error getting storage stats:', error);
            return { error: error.message };
        }
    }

    // Health check method for monitoring
    async healthCheck() {
        if (!this.containerClient) {
            return { status: 'disabled', message: 'Azure Blob Storage not configured' };
        }

        try {
            // Simple health check by checking if container exists
            const exists = await this.containerClient.exists();
            
            if (exists) {
                return { 
                    status: 'healthy', 
                    message: 'Azure Blob Storage is accessible',
                    containerName: this.containerName
                };
            } else {
                return { 
                    status: 'unhealthy', 
                    message: 'Container does not exist',
                    containerName: this.containerName
                };
            }
        } catch (error) {
            return { 
                status: 'unhealthy', 
                message: error.message,
                containerName: this.containerName
            };
        }
    }
}

export default AzureBlobService;

