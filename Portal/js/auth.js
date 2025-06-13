/**
 * JAM Capital Consultants - Authentication Utility
 * Centralized token management and authentication helpers
 */

class AuthManager {
    constructor() {
        this.API_BASE_URL = 'https://jam-capital-backend.azurewebsites.net';
        this.TOKEN_KEY = 'authToken';
        this.USER_DATA_KEY = 'userData';
        this.listeners = [];
        this._initialized = false;
    }

    /**
     * Get authentication token from storage
     * @returns {string|null} JWT token or null if not found
     */
    getAuthToken() {
        // Try multiple storage locations for backwards compatibility
        const token = localStorage.getItem(this.TOKEN_KEY) ||
                     sessionStorage.getItem(this.TOKEN_KEY) ||
                     localStorage.getItem('userToken') ||
                     sessionStorage.getItem('userToken');

        if (!token) {
            console.warn('⚠️ No authentication token found');
            return null;
        }

        // Validate token format (basic check)
        if (!token.includes('.')) {
            console.warn('⚠️ Invalid token format found');
            this.clearAuth();
            return null;
        }

        return token;
    }

    /**
     * Store authentication token
     * @param {string} token - JWT token
     */
    setAuthToken(token) {
        if (!token) {
            console.error('❌ Cannot store empty token');
            return;
        }

        localStorage.setItem(this.TOKEN_KEY, token);
        console.log('✅ Auth token stored successfully');
        this.notifyListeners('tokenUpdated', token);
    }

    /**
     * Get user data from storage
     * @returns {object|null} User data object or null if not found
     */
    getUserData() {
        try {
            const userData = localStorage.getItem(this.USER_DATA_KEY) ||
                           sessionStorage.getItem(this.USER_DATA_KEY);
            
            if (!userData) {
                console.warn('⚠️ No user data found');
                return null;
            }

            return JSON.parse(userData);
        } catch (error) {
            console.error('❌ Error parsing user data:', error);
            this.clearAuth();
            return null;
        }
    }

    /**
     * Store user data
     * @param {object} userData - User data object
     */
    setUserData(userData) {
        if (!userData) {
            console.error('❌ Cannot store empty user data');
            return;
        }

        localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
        console.log('✅ User data stored successfully');
        this.notifyListeners('userDataUpdated', userData);
    }

    /**
     * Get user ID from stored user data
     * @returns {string|null} User ID or null if not found
     */
    getUserId() {
        const userData = this.getUserData();
        return userData?.id || null;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user has valid token and data
     */
    isAuthenticated() {
        const token = this.getAuthToken();
        const userData = this.getUserData();
        
        const isAuth = !!(token && userData?.id);
        console.log('🔍 Authentication check:', isAuth ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');
        
        return isAuth;
    }

    /**
     * Check if user has admin role
     * @returns {boolean} True if user is admin
     */
    isAdmin() {
        const userData = this.getUserData();
        const role = userData?.role || userData?.userRole;
        return role === 'admin';
    }

    /**
     * Clear all authentication data
     */
    clearAuth() {
        // Clear from both localStorage and sessionStorage
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_DATA_KEY);
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.USER_DATA_KEY);
        sessionStorage.removeItem('userToken');
        sessionStorage.removeItem('user');
        
        console.log('🧹 Authentication data cleared');
        this.notifyListeners('authCleared');
    }

    /**
     * Make authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async authenticatedFetch(endpoint, options = {}) {
        const token = this.getAuthToken();
        
        if (!token) {
            throw new Error('No authentication token available');
        }

        // Build full URL
        const url = endpoint.startsWith('http') ? endpoint : `${this.API_BASE_URL}${endpoint}`;
        
        // Add auth header
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        console.log('🌐 Making authenticated request to:', endpoint);
        
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Check for auth errors
        if (response.status === 401 || response.status === 403) {
            console.error('❌ Authentication failed - clearing auth data');
            this.clearAuth();
            window.location.href = '/login';
            throw new Error('Authentication failed');
        }

        return response;
    }

    /**
     * Handle login success
     * @param {object} data - Login response data
     */
    handleLoginSuccess(data) {
        if (data.token && data.user) {
            this.setAuthToken(data.token);
            this.setUserData(data.user);
            console.log('✅ Login success handled');
            this.notifyListeners('loginSuccess', data);
        } else {
            console.error('❌ Invalid login response data');
            throw new Error('Invalid login response');
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        this.clearAuth();
        console.log('👋 User logged out');
        this.notifyListeners('logout');
        window.location.href = '/';
    }

    /**
     * Add event listener for auth events
     * @param {function} callback - Callback function
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove event listener
     * @param {function} callback - Callback function to remove
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notify all listeners of auth events
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('❌ Error in auth listener:', error);
            }
        });
    }

    /**
     * Initialize auth manager
     */
    init() {
        console.log('🚀 AuthManager initialized');
        
        // Check if user is authenticated on init
        if (this.isAuthenticated()) {
            console.log('✅ User is authenticated');
        } else {
            console.log('ℹ️ User is not authenticated');
        }

        this._initialized = true;
    }
}

// Create global instance immediately 
window.authManager = new AuthManager();

// Legacy function support for backwards compatibility
window.getAuthToken = () => window.authManager.getAuthToken();
window.getUserId = () => window.authManager.getUserId();
window.getUserData = () => window.authManager.getUserData();
window.isAuthenticated = () => window.authManager.isAuthenticated();

// Initialize immediately - don't wait for DOM
window.authManager.init();

// Also initialize on DOM load as backup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.authManager._initialized) {
            window.authManager.init();
        }
    });
} else {
    if (!window.authManager._initialized) {
        window.authManager.init();
    }
}

console.log('🔧 JAM Capital Auth utility loaded - authManager available immediately'); 