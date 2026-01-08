// ZiVPN Manager - Main Application JavaScript
class ZiVPNApp {
    constructor() {
        this.api = new APIClient();
        this.websocket = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        try {
            // Check if user is authenticated
            await this.checkAuth();
            
            // Initialize UI components
            this.initializeNavigation();
            this.initializeEventListeners();
            this.initializeWebSocket();
            
            // Load initial data
            if (this.isAuthenticated) {
                await this.loadInitialData();
                this.startPeriodicRefresh();
            }
            
            // Show login modal if not authenticated
            if (!this.isAuthenticated) {
                this.showLoginModal();
            }
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    async checkAuth() {
        try {
            const token = this.getStoredToken();
            if (!token) {
                this.isAuthenticated = false;
                return;
            }

            // Set token for API client
            this.api.setToken(token);
            
            // Verify token by getting user info
            const response = await this.api.get('/auth/me');
            
            if (response.success) {
                this.currentUser = response.data;
                this.isAuthenticated = true;
                this.updateUserDisplay();
            } else {
                this.logout();
            }
            
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    initializeNavigation() {
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        const sections = document.querySelectorAll('.content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all nav links and sections
                navLinks.forEach(l => l.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                // Add active class to clicked link
                link.classList.add('active');
                
                // Show corresponding section
                const sectionId = link.getAttribute('data-section');
                const section = document.getElementById(sectionId);
                if (section) {
                    section.classList.add('active');
                }
            });
        });

        // Dropdown menu handling
        const dropdownToggle = document.querySelector('.dropdown-toggle');
        const dropdownMenu = document.querySelector('.dropdown-menu');
        
        if (dropdownToggle && dropdownMenu) {
            dropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.style.display = 'none';
                }
            });
        }
    }

    initializeEventListeners() {
        // Modal handling
        this.initializeModals();
        
        // Form handling
        this.initializeForms();
        
        // Toast notifications
        this.initializeToasts();
        
        // Loading overlay
        this.initializeLoading();
    }

    initializeModals() {
        // Close modal when clicking close button or backdrop
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') || e.target.classList.contains('modal-close')) {
                this.closeModal(e.target.closest('.modal'));
            }
            
            if (e.target.getAttribute('data-dismiss') === 'modal') {
                this.closeModal(e.target.closest('.modal'));
            }
        });

        // Prevent modal content click from closing modal
        document.querySelectorAll('.modal-content').forEach(content => {
            content.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    initializeForms() {
        // Form submission handling
        document.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmission(e.target);
        });
    }

    initializeToasts() {
        // Toast container is created automatically
        window.showToast = (message, type = 'info', duration = 5000) => {
            this.showToast(message, type, duration);
        };
    }

    initializeLoading() {
        window.showLoading = () => {
            document.getElementById('loading-overlay').classList.add('show');
        };
        
        window.hideLoading = () => {
            document.getElementById('loading-overlay').classList.remove('show');
        };
    }

    initializeWebSocket() {
        if (!this.isAuthenticated) return;
        
        try {
            this.websocket = new WebSocketManager(this.api);
            
            // Subscribe to updates
            this.websocket.subscribe(['status', 'connections', 'logs']);
            
            // Handle WebSocket events
            this.websocket.on('status_update', (data) => {
                this.updateDashboard(data);
            });
            
            this.websocket.on('connection_update', (data) => {
                this.updateConnections(data);
            });
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

    async loadInitialData() {
        try {
            this.showLoading();
            
            // Load dashboard data
            await this.refreshDashboard();
            
            // Load tunnels
            await this.loadTunnels();
            
            // Load proxies
            await this.loadProxies();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    startPeriodicRefresh() {
        // Refresh dashboard every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.isAuthenticated) {
                this.refreshDashboard();
            }
        }, 30000);
    }

    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Authentication Methods
    async login(username, password, rememberMe = false) {
        try {
            const response = await this.api.post('/auth/login', {
                username,
                password,
                rememberMe
            });
            
            if (response.success) {
                this.currentUser = response.data.user;
                this.isAuthenticated = true;
                
                // Store token
                this.storeToken(response.data.token);
                this.api.setToken(response.data.token);
                
                // Update UI
                this.updateUserDisplay();
                this.hideLoginModal();
                
                // Initialize data and WebSocket
                await this.loadInitialData();
                this.initializeWebSocket();
                
                this.showToast('Login successful', 'success');
                return true;
            } else {
                this.showToast(response.error || 'Login failed', 'error');
                return false;
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed', 'error');
            return false;
        }
    }

    async logout() {
        try {
            await this.api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear all state
            this.currentUser = null;
            this.isAuthenticated = false;
            this.clearStoredToken();
            this.stopPeriodicRefresh();
            
            if (this.websocket) {
                this.websocket.disconnect();
            }
            
            // Show login modal
            this.showLoginModal();
        }
    }

    storeToken(token) {
        localStorage.setItem('zivpn_token', token);
    }

    getStoredToken() {
        return localStorage.getItem('zivpn_token');
    }

    clearStoredToken() {
        localStorage.removeItem('zivpn_token');
    }

    updateUserDisplay() {
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay && this.currentUser) {
            usernameDisplay.textContent = this.currentUser.username;
        }
    }

    // Modal Methods
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // Reset form if exists
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }

    showLoginModal() {
        this.showModal('login-modal');
    }

    hideLoginModal() {
        this.closeModal(document.getElementById('login-modal'));
    }

    // Toast Notifications
    showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <button class="toast-close">&times;</button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        
        // Add close functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.closeToast(toast);
        });
        
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto close
        setTimeout(() => {
            this.closeToast(toast);
        }, duration);
    }

    closeToast(toast) {
        if (toast && toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.parentNode.removeChild(toast);
            }, 300);
        }
    }

    // Dashboard Methods
    async refreshDashboard() {
        try {
            const [statusResponse, systemResponse] = await Promise.all([
                this.api.get('/vpn/status'),
                this.api.get('/status/summary')
            ]);
            
            if (statusResponse.success) {
                this.updateDashboardStats(statusResponse.data);
            }
            
            if (systemResponse.success) {
                this.updateSystemInfo(systemResponse.data);
            }
            
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    }

    updateDashboardStats(data) {
        const { stats, activeConnections } = data;
        
        // Update stats cards
        this.updateElement('active-connections-count', stats.activeConnections || 0);
        this.updateElement('total-connections-count', stats.totalConnections || 0);
        this.updateElement('uptime-display', this.formatUptime(stats.uptime || Date.now()));
        this.updateElement('memory-usage', this.formatBytes(stats.bytesTransferred || 0));
        
        // Update connections table
        this.updateConnectionsTable(activeConnections || []);
    }

    updateDashboard(data) {
        if (data.stats) {
            this.updateDashboardStats(data);
        }
    }

    updateConnections(data) {
        this.updateConnectionsTable(data.connections || []);
    }

    updateConnectionsTable(connections) {
        const tbody = document.getElementById('connections-tbody');
        if (!tbody) return;
        
        if (connections.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No active connections</td></tr>';
            return;
        }
        
        tbody.innerHTML = connections.map(conn => `
            <tr>
                <td>${this.escapeHtml(conn.name)}</td>
                <td><span class="badge badge-info">${conn.type}</span></td>
                <td><span class="connection-indicator"><span class="connection-dot ${conn.status}"></span>${conn.status}</span></td>
                <td>${this.formatDate(conn.createdAt)}</td>
                <td>${this.formatDate(conn.lastActivity)}</td>
                <td>${this.formatBytes(conn.bytesTransferred)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="app.closeConnection('${conn.id}')">
                        <i class="icon-stop"></i> Close
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateSystemInfo(data) {
        if (data.system) {
            this.updateElement('system-platform', data.system.platform);
            this.updateElement('system-arch', data.system.arch);
            this.updateElement('system-cpus', data.system.cpus);
            this.updateElement('node-version', data.application.version);
        }
    }

    // Utility Methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    formatUptime(timestamp) {
        const uptime = Date.now() - timestamp;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Action Methods
    async closeConnection(connectionId) {
        if (!confirm('Are you sure you want to close this connection?')) {
            return;
        }
        
        try {
            const response = await this.api.post(`/vpn/connections/${connectionId}/close`);
            
            if (response.success) {
                this.showToast('Connection closed successfully', 'success');
                await this.refreshDashboard();
            } else {
                this.showToast(response.error || 'Failed to close connection', 'error');
            }
            
        } catch (error) {
            console.error('Close connection error:', error);
            this.showToast('Failed to close connection', 'error');
        }
    }

    async handleFormSubmission(form) {
        const action = form.getAttribute('data-action');
        
        switch (action) {
            case 'login':
                await this.handleLoginForm(form);
                break;
            case 'create-tunnel':
                await this.handleCreateTunnel(form);
                break;
            case 'create-proxy':
                await this.handleCreateProxy(form);
                break;
            default:
                console.warn('Unknown form action:', action);
        }
    }

    async handleLoginForm(form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');
        const rememberMe = formData.get('rememberMe') === 'on';
        
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
        }
        
        const success = await this.login(username, password, rememberMe);
        
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }

    async handleCreateTunnel(form) {
        const formData = new FormData(form);
        const tunnelData = Object.fromEntries(formData.entries());
        
        // Convert checkboxes
        tunnelData.autoReconnect = form.querySelector('#auto-reconnect').checked;
        
        try {
            const response = await this.api.post('/vpn/tunnels', tunnelData);
            
            if (response.success) {
                this.showToast('Tunnel created successfully', 'success');
                this.closeModal(document.getElementById('create-tunnel-modal'));
                await this.loadTunnels();
            } else {
                this.showToast(response.error || 'Failed to create tunnel', 'error');
            }
            
        } catch (error) {
            console.error('Create tunnel error:', error);
            this.showToast('Failed to create tunnel', 'error');
        }
    }

    async handleCreateProxy(form) {
        const formData = new FormData(form);
        const proxyData = Object.fromEntries(formData.entries());
        
        try {
            const response = await this.api.post('/vpn/proxies', proxyData);
            
            if (response.success) {
                this.showToast('Proxy created successfully', 'success');
                this.closeModal(document.getElementById('create-proxy-modal'));
                await this.loadProxies();
            } else {
                this.showToast(response.error || 'Failed to create proxy', 'error');
            }
            
        } catch (error) {
            console.error('Create proxy error:', error);
            this.showToast('Failed to create proxy', 'error');
        }
    }

    // Placeholder methods - these will be implemented in specific module files
    async loadTunnels() {
        // This will be implemented in tunnels.js
    }

    async loadProxies() {
        // This will be implemented in proxies.js
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ZiVPNApp();
});