// ZiVPN Manager - Dashboard Module
class DashboardManager {
    constructor(app) {
        this.app = app;
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.startPeriodicRefresh();
    }

    initializeEventListeners() {
        // Refresh connections button
        const refreshBtn = document.getElementById('refresh-connections');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshConnections();
            });
        }

        // Refresh system button
        const systemBtn = document.getElementById('refresh-system');
        if (systemBtn) {
            systemBtn.addEventListener('click', () => {
                this.refreshSystemInfo();
            });
        }

        // Auto-refresh toggle
        this.setupAutoRefreshToggle();
    }

    setupAutoRefreshToggle() {
        // Add auto-refresh toggle to dashboard
        const dashboardSection = document.querySelector('#dashboard .section-header');
        if (dashboardSection) {
            const autoRefreshToggle = document.createElement('div');
            autoRefreshToggle.className = 'auto-refresh-toggle';
            autoRefreshToggle.innerHTML = `
                <label class="checkbox-label">
                    <input type="checkbox" id="auto-refresh-toggle" checked>
                    <span class="checkmark"></span>
                    Auto refresh (30s)
                </label>
            `;
            dashboardSection.appendChild(autoRefreshToggle);

            const toggle = document.getElementById('auto-refresh-toggle');
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.startPeriodicRefresh();
                    } else {
                        this.stopPeriodicRefresh();
                    }
                });
            }
        }
    }

    startPeriodicRefresh() {
        this.stopPeriodicRefresh();
        this.refreshInterval = setInterval(() => {
            this.refreshAll();
        }, 30000); // 30 seconds
    }

    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async refreshAll() {
        await Promise.all([
            this.refreshConnections(),
            this.refreshSystemInfo(),
            this.refreshStatus()
        ]);
    }

    async refreshConnections() {
        try {
            const response = await this.app.api.get('/vpn/connections');
            if (response.success) {
                this.updateConnectionsTable(response.data.connections);
                this.updateConnectionStats(response.data.connections);
            }
        } catch (error) {
            console.error('Failed to refresh connections:', error);
        }
    }

    async refreshSystemInfo() {
        try {
            const response = await this.app.api.get('/status/summary');
            if (response.success) {
                this.updateSystemDisplay(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh system info:', error);
        }
    }

    async refreshStatus() {
        try {
            const response = await this.app.api.get('/vpn/status');
            if (response.success) {
                this.updateVPNStatus(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh VPN status:', error);
        }
    }

    updateConnectionsTable(connections) {
        const tbody = document.getElementById('connections-tbody');
        if (!tbody) return;

        if (!connections || connections.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">🔌</div>
                            <p class="empty-title">No Active Connections</p>
                            <p class="empty-description">Create your first tunnel or proxy to get started</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = connections.map(conn => `
            <tr>
                <td>
                    <div class="connection-name">
                        <strong>${this.escapeHtml(conn.name)}</strong>
                        <br>
                        <small class="text-muted">${conn.id}</small>
                    </div>
                </td>
                <td>
                    <span class="badge badge-info">
                        ${this.getConnectionTypeIcon(conn.type)} ${conn.type}
                    </span>
                </td>
                <td>
                    <span class="connection-indicator">
                        <span class="connection-dot ${conn.status}"></span>
                        ${conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="timestamp">
                        ${this.formatRelativeTime(conn.createdAt)}
                    </div>
                    <small class="text-muted">
                        ${new Date(conn.createdAt).toLocaleTimeString()}
                    </small>
                </td>
                <td>
                    <div class="timestamp">
                        ${this.formatRelativeTime(conn.lastActivity)}
                    </div>
                    <small class="text-muted">
                        ${new Date(conn.lastActivity).toLocaleTimeString()}
                    </small>
                </td>
                <td>
                    <div class="bytes-transferred">
                        ${this.formatBytes(conn.bytesTransferred)}
                    </div>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${this.calculateTrafficPercentage(conn.bytesTransferred)}%"></div>
                    </div>
                </td>
                <td>
                    <div class="connection-actions">
                        <button class="btn btn-sm btn-danger" 
                                onclick="dashboard.closeConnection('${conn.id}')"
                                data-tooltip="Close Connection">
                            <i class="icon-stop"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary" 
                                onclick="dashboard.viewConnectionDetails('${conn.id}')"
                                data-tooltip="View Details">
                            <i class="icon-settings-small"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateConnectionStats(connections) {
        const totalConnections = connections.length;
        const sshTunnels = connections.filter(c => c.type === 'ssh-tunnel').length;
        const httpProxies = connections.filter(c => c.type === 'http-proxy').length;

        // Update stats cards
        this.updateElement('active-connections-count', totalConnections);
        
        // Update secondary stats if elements exist
        this.updateElement('ssh-tunnels-count', sshTunnels);
        this.updateElement('http-proxies-count', httpProxies);
    }

    updateSystemDisplay(data) {
        if (!data) return;

        const { application, system, memory, vpn } = data;

        // Update application info
        this.updateElement('uptime-display', this.formatUptime(application.uptime * 1000));
        this.updateElement('node-version', application.version);

        // Update system info
        this.updateElement('system-platform', `${system.platform} ${system.arch}`);
        this.updateElement('system-cpus', system.cpus);
        this.updateElement('system-memory', this.formatBytes(system.totalMemory));

        // Update memory usage
        this.updateElement('memory-usage', this.formatBytes(memory.heapUsed));
        this.updateElement('memory-percentage', this.calculateMemoryPercentage(memory.heapUsed, memory.heapTotal));

        // Update VPN stats
        this.updateElement('total-connections-count', vpn.totalConnections);
        this.updateElement('vpn-uptime', vpn.uptime ? this.formatUptime(vpn.uptime) : 'N/A');
    }

    updateVPNStatus(data) {
        const { stats } = data;
        
        // Update any VPN-specific status indicators
        const statusElements = document.querySelectorAll('.vpn-status');
        statusElements.forEach(element => {
            element.textContent = stats.activeConnections > 0 ? 'Active' : 'Inactive';
            element.className = `vpn-status ${stats.activeConnections > 0 ? 'status-active' : 'status-inactive'}`;
        });
    }

    // Utility methods
    getConnectionTypeIcon(type) {
        const icons = {
            'ssh-tunnel': '🔗',
            'http-proxy': '🌐',
            'socks-proxy': '🧦'
        };
        return icons[type] || '🔌';
    }

    calculateTrafficPercentage(bytes) {
        // Calculate percentage based on some arbitrary large number
        const maxBytes = 1024 * 1024 * 100; // 100MB
        return Math.min((bytes / maxBytes) * 100, 100);
    }

    calculateMemoryPercentage(used, total) {
        return total > 0 ? Math.round((used / total) * 100) : 0;
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return `${seconds}s ago`;
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

    formatUptime(timestamp) {
        const uptime = Date.now() - timestamp;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Action methods
    async closeConnection(connectionId) {
        if (!confirm('Are you sure you want to close this connection?')) {
            return;
        }

        try {
            const response = await this.app.api.closeConnection(connectionId);
            if (response.success) {
                this.app.showToast('Connection closed successfully', 'success');
                await this.refreshConnections();
            } else {
                this.app.showToast(response.error || 'Failed to close connection', 'error');
            }
        } catch (error) {
            console.error('Close connection error:', error);
            this.app.showToast('Failed to close connection', 'error');
        }
    }

    viewConnectionDetails(connectionId) {
        // Navigate to connection details or show modal
        window.location.hash = `connection/${connectionId}`;
    }

    // Cleanup
    destroy() {
        this.stopPeriodicRefresh();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.app) {
        window.dashboard = new DashboardManager(window.app);
    }
});