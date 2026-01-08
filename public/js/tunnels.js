// ZiVPN Manager - Tunnels Management
class TunnelManager {
    constructor(app) {
        this.app = app;
        this.tunnels = [];
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.loadTunnels();
    }

    initializeEventListeners() {
        // Create tunnel button
        const createBtn = document.getElementById('create-tunnel-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.showCreateTunnelModal();
            });
        }

        // Save tunnel button
        const saveBtn = document.getElementById('save-tunnel');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.handleCreateTunnel();
            });
        }

        // Export tunnels button
        const exportBtn = document.getElementById('export-tunnels');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportTunnels();
            });
        }

        // Search tunnels
        const searchInput = document.getElementById('tunnel-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTunnels(e.target.value);
            });
        }
    }

    async loadTunnels() {
        try {
            this.showLoading();
            
            // Get tunnel status from VPN service
            const response = await this.app.api.get('/vpn/status');
            
            if (response.success) {
                this.tunnels = response.data.configuredTunnels || [];
                this.updateTunnelList();
            }
        } catch (error) {
            console.error('Failed to load tunnels:', error);
            this.app.showToast('Failed to load tunnels', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateTunnelList() {
        const container = document.getElementById('tunnel-list');
        if (!container) return;

        if (this.tunnels.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = this.tunnels.map(tunnel => this.getTunnelItemHTML(tunnel)).join('');
        
        // Add event listeners for tunnel actions
        this.addTunnelActionListeners();
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">🔗</div>
                <h3 class="empty-title">No SSH Tunnels Configured</h3>
                <p class="empty-description">Create your first SSH tunnel to get started with secure connections</p>
                <button class="btn btn-primary" onclick="tunnelManager.showCreateTunnelModal()">
                    <i class="icon-plus"></i> Create Your First Tunnel
                </button>
            </div>
        `;
    }

    getTunnelItemHTML(tunnel) {
        const isRunning = tunnel.status === 'running';
        const statusClass = isRunning ? 'status-running' : 'status-stopped';
        const statusText = isRunning ? 'Running' : 'Stopped';
        const actionButton = isRunning ? 
            `<button class="btn btn-warning btn-sm" onclick="tunnelManager.stopTunnel('${tunnel.id}')">
                <i class="icon-stop"></i> Stop
            </button>` :
            `<button class="btn btn-success btn-sm" onclick="tunnelManager.startTunnel('${tunnel.id}')">
                <i class="icon-play"></i> Start
            </button>`;

        return `
            <div class="tunnel-item" data-tunnel-id="${tunnel.id}">
                <div class="tunnel-header">
                    <h3 class="tunnel-name">${this.escapeHtml(tunnel.name)}</h3>
                    <div class="tunnel-status">
                        <span class="badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="tunnel-info">
                    <div class="info-item">
                        <span class="info-label">Host</span>
                        <span class="info-value">${this.escapeHtml(tunnel.config?.host || 'N/A')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Port</span>
                        <span class="info-value">${tunnel.config?.port || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Local Port</span>
                        <span class="info-value">${tunnel.config?.localPort || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Remote</span>
                        <span class="info-value">${this.escapeHtml(tunnel.config?.remoteHost || 'localhost')}:${tunnel.config?.remotePort || '80'}</span>
                    </div>
                </div>
                <div class="tunnel-actions">
                    ${actionButton}
                    <button class="btn btn-secondary btn-sm" onclick="tunnelManager.editTunnel('${tunnel.id}')">
                        <i class="icon-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="tunnelManager.deleteTunnel('${tunnel.id}')">
                        <i class="icon-delete"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    addTunnelActionListeners() {
        // Additional action listeners can be added here
    }

    showCreateTunnelModal() {
        const modal = document.getElementById('create-tunnel-modal');
        if (modal) {
            this.app.showModal('create-tunnel-modal');
            this.resetCreateTunnelForm();
        }
    }

    resetCreateTunnelForm() {
        const form = document.getElementById('create-tunnel-form');
        if (form) {
            form.reset();
            
            // Set default values
            const portInput = document.getElementById('tunnel-port');
            if (portInput) portInput.value = '22';
            
            const localPortInput = document.getElementById('local-port');
            if (localPortInput) localPortInput.value = '1080';
            
            const remoteHostInput = document.getElementById('remote-host');
            if (remoteHostInput) remoteHostInput.value = 'localhost';
            
            const remotePortInput = document.getElementById('remote-port');
            if (remotePortInput) remotePortInput.value = '80';
            
            const autoReconnectInput = document.getElementById('auto-reconnect');
            if (autoReconnectInput) autoReconnectInput.checked = true;
            
            const reconnectDelayInput = document.getElementById('reconnect-delay');
            if (reconnectDelayInput) reconnectDelayInput.value = '5000';
        }
    }

    async handleCreateTunnel() {
        const form = document.getElementById('create-tunnel-form');
        if (!form) return;

        // Validate form
        if (!this.validateTunnelForm(form)) {
            return;
        }

        const formData = new FormData(form);
        const tunnelData = Object.fromEntries(formData.entries());

        // Convert checkboxes
        tunnelData.autoReconnect = form.querySelector('#auto-reconnect').checked;
        
        // Convert numeric fields
        tunnelData.port = parseInt(tunnelData.port) || 22;
        tunnelData.localPort = parseInt(tunnelData.localPort) || 1080;
        tunnelData.remotePort = parseInt(tunnelData.remotePort) || 80;
        tunnelData.reconnectDelay = parseInt(tunnelData.reconnectDelay) || 5000;

        try {
            this.showLoading();
            
            const response = await this.app.api.createTunnel(tunnelData);
            
            if (response.success) {
                this.app.showToast('Tunnel created successfully', 'success');
                this.app.closeModal(document.getElementById('create-tunnel-modal'));
                await this.loadTunnels();
            } else {
                this.app.showToast(response.error || 'Failed to create tunnel', 'error');
            }
        } catch (error) {
            console.error('Create tunnel error:', error);
            this.app.showToast('Failed to create tunnel', 'error');
        } finally {
            this.hideLoading();
        }
    }

    validateTunnelForm(form) {
        const name = form.querySelector('#tunnel-name').value.trim();
        const host = form.querySelector('#tunnel-host').value.trim();
        const username = form.querySelector('#tunnel-username').value.trim();
        const localPort = parseInt(form.querySelector('#local-port').value);
        const remotePort = parseInt(form.querySelector('#remote-port').value);

        if (!name) {
            this.app.showToast('Tunnel name is required', 'error');
            return false;
        }

        if (!host) {
            this.app.showToast('SSH host is required', 'error');
            return false;
        }

        if (!username) {
            this.app.showToast('Username is required', 'error');
            return false;
        }

        if (!Utils.isValidPort(localPort)) {
            this.app.showToast('Local port must be between 1024 and 65535', 'error');
            return false;
        }

        if (!Utils.isValidPort(remotePort)) {
            this.app.showToast('Remote port must be between 1 and 65535', 'error');
            return false;
        }

        return true;
    }

    async startTunnel(tunnelId) {
        try {
            this.showLoading();
            
            const response = await this.app.api.startTunnel(tunnelId);
            
            if (response.success) {
                this.app.showToast('Tunnel started successfully', 'success');
                await this.loadTunnels();
            } else {
                this.app.showToast(response.error || 'Failed to start tunnel', 'error');
            }
        } catch (error) {
            console.error('Start tunnel error:', error);
            this.app.showToast('Failed to start tunnel', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async stopTunnel(tunnelId) {
        try {
            this.showLoading();
            
            const response = await this.app.api.stopTunnel(tunnelId);
            
            if (response.success) {
                this.app.showToast('Tunnel stopped successfully', 'success');
                await this.loadTunnels();
            } else {
                this.app.showToast(response.error || 'Failed to stop tunnel', 'error');
            }
        } catch (error) {
            console.error('Stop tunnel error:', error);
            this.app.showToast('Failed to stop tunnel', 'error');
        } finally {
            this.hideLoading();
        }
    }

    editTunnel(tunnelId) {
        const tunnel = this.tunnels.find(t => t.id === tunnelId);
        if (!tunnel) {
            this.app.showToast('Tunnel not found', 'error');
            return;
        }

        // Populate edit form (implement edit functionality)
        this.showCreateTunnelModal();
        
        // TODO: Populate form with tunnel data for editing
        this.app.showToast('Edit functionality coming soon', 'info');
    }

    async deleteTunnel(tunnelId) {
        const tunnel = this.tunnels.find(t => t.id === tunnelId);
        if (!tunnel) {
            this.app.showToast('Tunnel not found', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete tunnel "${tunnel.name}"?`)) {
            return;
        }

        try {
            this.showLoading();
            
            const response = await this.app.api.removeTunnel(tunnelId);
            
            if (response.success) {
                this.app.showToast('Tunnel deleted successfully', 'success');
                await this.loadTunnels();
            } else {
                this.app.showToast(response.error || 'Failed to delete tunnel', 'error');
            }
        } catch (error) {
            console.error('Delete tunnel error:', error);
            this.app.showToast('Failed to delete tunnel', 'error');
        } finally {
            this.hideLoading();
        }
    }

    searchTunnels(query) {
        const tunnelItems = document.querySelectorAll('.tunnel-item');
        const lowercaseQuery = query.toLowerCase();

        tunnelItems.forEach(item => {
            const tunnelName = item.querySelector('.tunnel-name').textContent.toLowerCase();
            const host = item.querySelector('.info-value').textContent.toLowerCase();
            
            if (tunnelName.includes(lowercaseQuery) || host.includes(lowercaseQuery)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async exportTunnels() {
        try {
            const response = await this.app.api.exportConfiguration();
            
            if (response.success) {
                const data = JSON.stringify(response.data, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `zivpn-tunnels-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                this.app.showToast('Tunnels exported successfully', 'success');
            } else {
                this.app.showToast('Failed to export tunnels', 'error');
            }
        } catch (error) {
            console.error('Export tunnels error:', error);
            this.app.showToast('Failed to export tunnels', 'error');
        }
    }

    showLoading() {
        const container = document.getElementById('tunnel-list');
        if (container) {
            container.classList.add('dashboard-loading');
        }
    }

    hideLoading() {
        const container = document.getElementById('tunnel-list');
        if (container) {
            container.classList.remove('dashboard-loading');
        }
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    // Cleanup
    destroy() {
        // Remove event listeners if needed
    }
}

// Initialize tunnel manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.app) {
        window.tunnelManager = new TunnelManager(window.app);
    }
});