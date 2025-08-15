/**
 * JAM Capital API Client Library
 * 
 * A comprehensive JavaScript client for interacting with the JAM Capital backend API.
 * Provides authentication, user management, credential operations, and more.
 * 
 * @version 1.0.0
 * @author JAM Capital Consultants
 */

import fetch from 'node-fetch';

export class JamCapitalAPI {
    /**
     * Initialize the JAM Capital API client
     * @param {Object} config - Configuration options
     * @param {string} config.baseURL - Base URL of the API (default: production)
     * @param {string} config.apiKey - Optional API key for authentication
     * @param {boolean} config.debug - Enable debug logging
     */
    constructor(config = {}) {
        this.baseURL = config.baseURL || 'https://jam-capital-backend.azurewebsites.net/api';
        this.apiKey = config.apiKey || null;
        this.debug = config.debug || false;
        this.authToken = null;
        this.refreshToken = null;
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        this.log('JAM Capital API Client initialized', { baseURL: this.baseURL });
    }

    /**
     * Debug logging
     */
    log(message, data = null) {
        if (this.debug) {
            console.log(`[JAM-API] ${message}`, data || '');
        }
    }

    /**
     * Make HTTP request with error handling and interceptors
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        // Default options
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Add authentication if available
        if (this.authToken) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        // Merge options
        const requestOptions = { ...defaultOptions, ...options };
        
        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            await interceptor(requestOptions);
        }

        this.log(`${requestOptions.method} ${url}`, requestOptions.body ? JSON.parse(requestOptions.body) : null);

        try {
            const response = await fetch(url, requestOptions);
            const data = await response.json();

            // Apply response interceptors
            for (const interceptor of this.responseInterceptors) {
                await interceptor(response, data);
            }

            if (!response.ok) {
                throw new APIError(data.message || 'Request failed', response.status, data);
            }

            this.log(`Response ${response.status}`, data);
            return { data, status: response.status, headers: response.headers };

        } catch (error) {
            this.log(`Request failed: ${error.message}`);
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError(error.message, 0, null);
        }
    }

    // ==========================================
    // AUTHENTICATION METHODS
    // ==========================================

    /**
     * Authenticate admin user
     * @param {string} email - Admin email
     * @param {string} password - Admin password
     * @returns {Promise<Object>} Authentication result with token
     */
    async loginAdmin(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response.data.success && response.data.token) {
            this.authToken = response.data.token;
            this.log('Admin authenticated successfully');
        }

        return response.data;
    }

    /**
     * Authenticate regular user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Authentication result
     */
    async loginUser(email, password) {
        const response = await this.request('/auth/user/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (response.data.success && response.data.token) {
            this.authToken = response.data.token;
            this.log('User authenticated successfully');
        }

        return response.data;
    }

    /**
     * Logout and clear authentication
     */
    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } catch (error) {
            this.log('Logout request failed, clearing local auth anyway');
        }
        
        this.authToken = null;
        this.refreshToken = null;
        this.log('Logged out successfully');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.authToken;
    }

    // ==========================================
    // HEALTH & STATUS METHODS
    // ==========================================

    /**
     * Check API health status
     * @returns {Promise<Object>} Health status information
     */
    async getHealth() {
        const response = await this.request('/health');
        return response.data;
    }

    /**
     * Get API version and build information
     * @returns {Promise<Object>} Version information
     */
    async getVersion() {
        const response = await this.request('/version');
        return response.data;
    }

    // ==========================================
    // USER MANAGEMENT METHODS
    // ==========================================

    /**
     * Get user profile information
     * @param {string} userId - User ID (optional, uses current user if not provided)
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile(userId = null) {
        const endpoint = userId ? `/users/${userId}` : '/users/profile';
        const response = await this.request(endpoint);
        return response.data;
    }

    /**
     * Update user profile
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<Object>} Updated profile data
     */
    async updateUserProfile(profileData) {
        const response = await this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        return response.data;
    }

    /**
     * Search users (admin only)
     * @param {Object} searchParams - Search parameters
     * @param {string} searchParams.email - Email to search for
     * @param {string} searchParams.name - Name to search for
     * @param {number} searchParams.limit - Maximum results to return
     * @returns {Promise<Array>} Array of user objects
     */
    async searchUsers(searchParams = {}) {
        const queryString = new URLSearchParams(searchParams).toString();
        const endpoint = `/users/search${queryString ? `?${queryString}` : ''}`;
        const response = await this.request(endpoint);
        return response.data;
    }

    /**
     * Get all users (admin only)
     * @param {Object} options - Query options
     * @param {number} options.page - Page number
     * @param {number} options.limit - Items per page
     * @returns {Promise<Object>} Paginated user list
     */
    async getAllUsers(options = {}) {
        const queryString = new URLSearchParams(options).toString();
        const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
        const response = await this.request(endpoint);
        return response.data;
    }

    // ==========================================
    // CREDENTIAL MANAGEMENT METHODS
    // ==========================================

    /**
     * Store user credentials for a service
     * @param {Object} credentialData - Credential information
     * @param {string} credentialData.serviceType - Type of service (smartcredit, identityiq, etc.)
     * @param {string} credentialData.email - Service email
     * @param {string} credentialData.password - Service password
     * @param {string} credentialData.ssn - Last 4 digits of SSN
     * @param {string} credentialData.purpose - Purpose for storing credentials
     * @returns {Promise<Object>} Storage result
     */
    async storeCredentials(credentialData) {
        const response = await this.request('/credentials/store', {
            method: 'POST',
            body: JSON.stringify(credentialData)
        });
        return response.data;
    }

    /**
     * Retrieve user credentials (admin only)
     * @param {Object} retrievalParams - Retrieval parameters
     * @param {string} retrievalParams.userEmail - User's email address
     * @param {string} retrievalParams.serviceType - Service type to retrieve
     * @param {string} retrievalParams.purpose - Purpose for retrieval
     * @returns {Promise<Object>} Credential data
     */
    async retrieveCredentials(retrievalParams) {
        const response = await this.request('/credentials/admin/retrieve', {
            method: 'POST',
            body: JSON.stringify(retrievalParams)
        });
        return response.data;
    }

    /**
     * Update user credentials
     * @param {string} credentialId - Credential ID to update
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Update result
     */
    async updateCredentials(credentialId, updateData) {
        const response = await this.request(`/credentials/${credentialId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        return response.data;
    }

    /**
     * Delete user credentials
     * @param {string} credentialId - Credential ID to delete
     * @returns {Promise<Object>} Deletion result
     */
    async deleteCredentials(credentialId) {
        const response = await this.request(`/credentials/${credentialId}`, {
            method: 'DELETE'
        });
        return response.data;
    }

    /**
     * Get user's credential history
     * @param {string} userEmail - User's email address
     * @returns {Promise<Array>} Array of credential history entries
     */
    async getCredentialHistory(userEmail) {
        const response = await this.request(`/credentials/history?userEmail=${encodeURIComponent(userEmail)}`);
        return response.data;
    }

    // ==========================================
    // CHAT & AI METHODS
    // ==========================================

    /**
     * Send message to AI chat system
     * @param {Object} messageData - Message information
     * @param {string} messageData.message - User message
     * @param {string} messageData.context - Optional context
     * @returns {Promise<Object>} AI response
     */
    async sendChatMessage(messageData) {
        const response = await this.request('/chat/message', {
            method: 'POST',
            body: JSON.stringify(messageData)
        });
        return response.data;
    }

    /**
     * Get chat history
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of messages to retrieve
     * @returns {Promise<Array>} Chat history
     */
    async getChatHistory(options = {}) {
        const queryString = new URLSearchParams(options).toString();
        const endpoint = `/chat/history${queryString ? `?${queryString}` : ''}`;
        const response = await this.request(endpoint);
        return response.data;
    }

    // ==========================================
    // DOCUMENT MANAGEMENT METHODS
    // ==========================================

    /**
     * Upload document
     * @param {File|Buffer} file - File to upload
     * @param {Object} metadata - File metadata
     * @returns {Promise<Object>} Upload result
     */
    async uploadDocument(file, metadata = {}) {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('metadata', JSON.stringify(metadata));

        const response = await this.request('/documents/upload', {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type to let browser set it for FormData
        });
        return response.data;
    }

    /**
     * Get user documents
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of documents
     */
    async getDocuments(options = {}) {
        const queryString = new URLSearchParams(options).toString();
        const endpoint = `/documents${queryString ? `?${queryString}` : ''}`;
        const response = await this.request(endpoint);
        return response.data;
    }

    /**
     * Delete document
     * @param {string} documentId - Document ID to delete
     * @returns {Promise<Object>} Deletion result
     */
    async deleteDocument(documentId) {
        const response = await this.request(`/documents/${documentId}`, {
            method: 'DELETE'
        });
        return response.data;
    }

    // ==========================================
    // NOTIFICATION METHODS
    // ==========================================

    /**
     * Get user notifications
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of notifications
     */
    async getNotifications(options = {}) {
        const queryString = new URLSearchParams(options).toString();
        const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;
        const response = await this.request(endpoint);
        return response.data;
    }

    /**
     * Mark notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object>} Update result
     */
    async markNotificationRead(notificationId) {
        const response = await this.request(`/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        return response.data;
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Add request interceptor
     * @param {Function} interceptor - Function to modify requests
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * Add response interceptor
     * @param {Function} interceptor - Function to handle responses
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * Set authentication token manually
     * @param {string} token - JWT token
     */
    setAuthToken(token) {
        this.authToken = token;
        this.log('Auth token set manually');
    }

    /**
     * Get current authentication token
     * @returns {string|null} Current token
     */
    getAuthToken() {
        return this.authToken;
    }

    /**
     * Configure API client
     * @param {Object} config - Configuration options
     */
    configure(config) {
        if (config.baseURL) this.baseURL = config.baseURL;
        if (config.debug !== undefined) this.debug = config.debug;
        if (config.apiKey) this.apiKey = config.apiKey;
        
        this.log('API client reconfigured', config);
    }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

/**
 * Service type constants
 */
export const SERVICE_TYPES = {
    SMART_CREDIT: 'smartcredit',
    IDENTITY_IQ: 'identityiq',
    MY_SCORE_IQ: 'myscoreiq',
    CFPB: 'cfpb',
    ANNUAL_CREDIT_REPORT: 'annualcreditreport'
};

/**
 * API endpoints for reference
 */
export const ENDPOINTS = {
    // Authentication
    ADMIN_LOGIN: '/auth/login',
    USER_LOGIN: '/auth/user/login',
    LOGOUT: '/auth/logout',
    
    // Health
    HEALTH: '/health',
    VERSION: '/version',
    
    // Users
    USER_PROFILE: '/users/profile',
    USER_SEARCH: '/users/search',
    ALL_USERS: '/users',
    
    // Credentials
    STORE_CREDENTIALS: '/credentials/store',
    RETRIEVE_CREDENTIALS: '/credentials/admin/retrieve',
    CREDENTIAL_HISTORY: '/credentials/history',
    
    // Chat
    CHAT_MESSAGE: '/chat/message',
    CHAT_HISTORY: '/chat/history',
    
    // Documents
    UPLOAD_DOCUMENT: '/documents/upload',
    GET_DOCUMENTS: '/documents',
    
    // Notifications
    GET_NOTIFICATIONS: '/notifications'
};

// Default export for convenience
export default JamCapitalAPI; 