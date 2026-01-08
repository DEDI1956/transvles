// ZiVPN Manager - Authentication Module
class AuthManager {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.checkAuthState();
    }

    initializeEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e.target);
            });
        }

        // Login button click
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin(document.getElementById('login-form'));
            });
        }

        // Logout handlers
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="logout"]')) {
                e.preventDefault();
                this.handleLogout();
            }
        });

        // Auto logout on token expiration
        this.setupTokenExpirationCheck();
    }

    checkAuthState() {
        const token = this.app.getStoredToken();
        if (token) {
            this.verifyToken(token);
        }
    }

    async verifyToken(token) {
        try {
            this.app.api.setToken(token);
            const response = await this.app.api.getCurrentUser();
            
            if (response.success) {
                this.app.currentUser = response.data;
                this.app.isAuthenticated = true;
                this.updateUserInterface();
                this.hideLoginModal();
            } else {
                this.handleAuthFailure();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            this.handleAuthFailure();
        }
    }

    async handleLogin(form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');
        const rememberMe = formData.get('rememberMe') === 'on';

        // Validate input
        if (!username || !password) {
            this.app.showToast('Username and password are required', 'error');
            return;
        }

        // Show loading state
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
        }

        try {
            const success = await this.app.login(username, password, rememberMe);
            
            if (success) {
                this.updateUserInterface();
                this.app.showToast('Login successful', 'success');
            } else {
                this.app.showToast('Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.app.showToast('Login failed: ' + error.message, 'error');
        } finally {
            // Reset button state
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        }
    }

    async handleLogout() {
        try {
            await this.app.logout();
            this.updateUserInterface();
            this.app.showToast('Logged out successfully', 'info');
        } catch (error) {
            console.error('Logout error:', error);
            this.app.showToast('Logout failed', 'error');
        }
    }

    updateUserInterface() {
        // Update username display
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay && this.app.currentUser) {
            usernameDisplay.textContent = this.app.currentUser.username;
        }

        // Show/hide admin features
        this.toggleAdminFeatures();

        // Update user menu
        this.updateUserMenu();
    }

    toggleAdminFeatures() {
        const isAdmin = this.app.currentUser?.role === 'admin';
        const adminElements = document.querySelectorAll('[data-admin-only]');
        
        adminElements.forEach(element => {
            if (isAdmin) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }

    updateUserMenu() {
        // Update user-specific menu items
        const userMenu = document.querySelector('.dropdown-menu');
        if (userMenu) {
            const userInfo = userMenu.querySelector('.user-info');
            if (userInfo && this.app.currentUser) {
                userInfo.innerHTML = `
                    <div class="user-details">
                        <div class="user-name">${this.escapeHtml(this.app.currentUser.username)}</div>
                        <div class="user-role">${this.app.currentUser.role}</div>
                    </div>
                `;
            }
        }
    }

    hideLoginModal() {
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            this.app.closeModal(loginModal);
        }
    }

    handleAuthFailure() {
        this.app.logout();
        this.app.showLoginModal();
    }

    setupTokenExpirationCheck() {
        // Check token expiration every minute
        setInterval(() => {
            const token = this.app.getStoredToken();
            if (!token) return;

            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const now = Date.now() / 1000;
                
                if (payload.exp && payload.exp < now) {
                    this.handleAuthFailure();
                    this.app.showToast('Session expired. Please login again.', 'warning');
                }
            } catch (error) {
                console.error('Token expiration check failed:', error);
            }
        }, 60000); // Check every minute
    }

    // User management methods
    async changePassword(currentPassword, newPassword) {
        try {
            const response = await this.app.api.changePassword(currentPassword, newPassword);
            if (response.success) {
                this.app.showToast('Password changed successfully', 'success');
                return true;
            } else {
                this.app.showToast(response.error || 'Failed to change password', 'error');
                return false;
            }
        } catch (error) {
            console.error('Change password error:', error);
            this.app.showToast('Failed to change password', 'error');
            return false;
        }
    }

    async getCurrentUser() {
        try {
            const response = await this.app.api.getCurrentUser();
            if (response.success) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    }

    // Permission checking
    hasPermission(permission) {
        return this.app.currentUser?.permissions?.includes(permission) || false;
    }

    isAdmin() {
        return this.app.currentUser?.role === 'admin';
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Session management
    extendSession() {
        const token = this.app.getStoredToken();
        if (token) {
            // Refresh token logic would go here
            this.verifyToken(token);
        }
    }

    // Auto-login for remember me
    attemptAutoLogin() {
        const rememberMe = localStorage.getItem('zivpn_remember_me');
        if (rememberMe === 'true') {
            const token = this.app.getStoredToken();
            if (token) {
                this.verifyToken(token);
            }
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.app) {
        window.authManager = new AuthManager(window.app);
        
        // Auto-login if remember me was checked
        window.authManager.attemptAutoLogin();
    }
});