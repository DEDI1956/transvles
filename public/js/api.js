// ZiVPN Manager - API Client
class APIClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = null;
        this.requestTimeout = 30000; // 30 seconds
    }

    getBaseURL() {
        // In production, this would be the actual API URL
        // For now, we'll use the same origin with /api prefix
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/api/v1`;
        }
        return '/api/v1';
    }

    setToken(token) {
        this.token = token;
    }

    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            headers = {},
            body = null,
            includeAuth = true,
            timeout = this.requestTimeout
        } = options;

        const url = `${this.baseURL}${endpoint}`;
        const requestHeaders = {
            ...this.getHeaders(includeAuth),
            ...headers
        };

        const config = {
            method,
            headers: requestHeaders,
        };

        if (body && method !== 'GET') {
            config.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        config.signal = controller.signal;

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            // Handle non-2xx responses
            if (!response.ok) {
                const errorData = await this.parseResponse(response);
                throw new APIError(
                    errorData.message || errorData.error || `HTTP ${response.status}`,
                    response.status,
                    errorData.code || 'API_ERROR',
                    errorData
                );
            }

            return await this.parseResponse(response);

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408, 'REQUEST_TIMEOUT');
            }
            
            if (error instanceof APIError) {
                throw error;
            }
            
            throw new APIError(
                error.message || 'Network error',
                0,
                'NETWORK_ERROR',
                { originalError: error }
            );
        }
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    }

    // HTTP Methods
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, data = null, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'POST', 
            body: data 
        });
    }

    async put(endpoint, data = null, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'PUT', 
            body: data 
        });
    }

    async patch(endpoint, data = null, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'PATCH', 
            body: data 
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // Authentication Endpoints
    async login(username, password, rememberMe = false) {
        return this.post('/auth/login', { username, password, rememberMe }, { includeAuth: false });
    }

    async logout() {
        return this.post('/auth/logout');
    }

    async refreshToken(refreshToken) {
        return this.post('/auth/refresh', { refreshToken }, { includeAuth: false });
    }

    async getCurrentUser() {
        return this.get('/auth/me');
    }

    async changePassword(currentPassword, newPassword) {
        return this.post('/auth/change-password', { currentPassword, newPassword });
    }

    // VPN Endpoints
    async getVPNStatus() {
        return this.get('/vpn/status');
    }

    async getConnections() {
        return this.get('/vpn/connections');
    }

    async getConnectionDetails(connectionId) {
        return this.get(`/vpn/connections/${connectionId}`);
    }

    async createTunnel(tunnelData) {
        return this.post('/vpn/tunnels', tunnelData);
    }

    async startTunnel(tunnelId) {
        return this.post(`/vpn/tunnels/${tunnelId}/start`);
    }

    async stopTunnel(tunnelId) {
        return this.post(`/vpn/tunnels/${tunnelId}/stop`);
    }

    async removeTunnel(tunnelId) {
        return this.delete(`/vpn/tunnels/${tunnelId}`);
    }

    async createProxy(proxyData) {
        return this.post('/vpn/proxies', proxyData);
    }

    async closeConnection(connectionId) {
        return this.post(`/vpn/connections/${connectionId}/close`);
    }

    async getVPNStats() {
        return this.get('/vpn/stats');
    }

    // Configuration Endpoints
    async getConfiguration() {
        return this.get('/config');
    }

    async getGlobalConfig() {
        return this.get('/config/global');
    }

    async updateGlobalConfig(config) {
        return this.put('/config/global', config);
    }

    async getSecurityConfig() {
        return this.get('/config/security');
    }

    async updateSecurityConfig(config) {
        return this.put('/config/security', config);
    }

    async getSSHConfig() {
        return this.get('/config/ssh');
    }

    async updateSSHConfig(config) {
        return this.put('/config/ssh', config);
    }

    async getProxyConfig() {
        return this.get('/config/proxy');
    }

    async updateProxyConfig(config) {
        return this.put('/config/proxy', config);
    }

    async resetConfiguration() {
        return this.post('/config/reset');
    }

    async exportConfiguration() {
        return this.post('/config/export');
    }

    async importConfiguration(config) {
        return this.post('/config/import', { configuration: config });
    }

    // Status Endpoints
    async getHealth() {
        return this.get('/status/health', { includeAuth: false });
    }

    async getSystemStatus() {
        return this.get('/status/system');
    }

    async getMetrics() {
        return this.get('/status/metrics');
    }

    async getLogs(level = null, limit = 100) {
        const params = new URLSearchParams();
        if (level) params.append('level', level);
        params.append('limit', limit.toString());
        
        return this.get(`/status/logs?${params.toString()}`);
    }

    async getStatusSummary() {
        return this.get('/status/summary');
    }

    async restartServices() {
        return this.post('/status/restart');
    }

    async getVersion() {
        return this.get('/status/version', { includeAuth: false });
    }

    // Utility Methods
    async checkConnection() {
        try {
            await this.getHealth();
            return true;
        } catch (error) {
            return false;
        }
    }

    isAuthenticated() {
        return !!this.token;
    }

    setBaseURL(url) {
        this.baseURL = url;
    }

    setTimeout(timeout) {
        this.requestTimeout = timeout;
    }
}

// Custom API Error Class
class APIError extends Error {
    constructor(message, status, code, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
        this.data = data;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError };
}