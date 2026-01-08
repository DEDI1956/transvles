const { NodeSSH } = require('node-ssh');
const { Client: SSHClient } = require('ssh2');
const EventEmitter = require('eventemitter3');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class VPNService extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.activeConnections = new Map();
    this.config = {
      tunnels: [],
      proxies: [],
      servers: []
    };
    this.reconnectIntervals = new Map();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      bytesTransferred: 0,
      uptime: Date.now()
    };
    this.initializeConfig();
  }

  async initialize() {
    try {
      // Load configuration
      await this.loadConfiguration();
      
      // Create necessary directories
      await this.createDirectories();
      
      // Load saved connection states
      await this.loadConnectionStates();
      
      this.logger.info('VPN Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize VPN Service:', error);
      throw error;
    }
  }

  async createDirectories() {
    const dirs = [
      path.join(__dirname, '..', 'logs'),
      path.join(__dirname, '..', 'config'),
      path.join(__dirname, '..', 'temp'),
      path.join(__dirname, '..', 'keys')
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
  }

  async initializeConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'vpn.config.json');
    
    // Default configuration
    const defaultConfig = {
      tunnels: [
        {
          id: 'default-ssh',
          name: 'Default SSH Tunnel',
          type: 'ssh',
          enabled: true,
          autoReconnect: true,
          reconnectDelay: 5000,
          config: {
            host: process.env.SSH_HOST || 'localhost',
            port: 22,
            username: process.env.SSH_USER || 'user',
            password: process.env.SSH_PASSWORD || '',
            privateKey: process.env.SSH_PRIVATE_KEY || '',
            localPort: 1080,
            remoteHost: 'localhost',
            remotePort: 80,
            localHost: '127.0.0.1'
          }
        }
      ],
      proxies: [
        {
          id: 'http-proxy',
          name: 'HTTP Proxy',
          type: 'http',
          enabled: true,
          port: 8080,
          config: {
            username: '',
            password: '',
            authRequired: false
          }
        }
      ],
      servers: []
    };

    try {
      if (!(await fs.pathExists(configPath))) {
        await fs.writeJSON(configPath, defaultConfig, { spaces: 2 });
      }
      
      this.config = await fs.readJSON(configPath);
    } catch (error) {
      this.logger.error('Failed to initialize config:', error);
      this.config = defaultConfig;
    }
  }

  async loadConfiguration() {
    const configPath = path.join(__dirname, '..', 'config', 'vpn.config.json');
    try {
      if (await fs.pathExists(configPath)) {
        this.config = await fs.readJSON(configPath);
        this.logger.info('Configuration loaded successfully');
      }
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  async saveConfiguration() {
    const configPath = path.join(__dirname, '..', 'config', 'vpn.config.json');
    try {
      await fs.writeJSON(configPath, this.config, { spaces: 2 });
      this.logger.info('Configuration saved successfully');
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  async loadConnectionStates() {
    const statePath = path.join(__dirname, '..', 'config', 'connection.states.json');
    try {
      if (await fs.pathExists(statePath)) {
        const states = await fs.readJSON(statePath);
        for (const [id, state] of Object.entries(states)) {
          if (state.autoReconnect) {
            this.scheduleReconnect(id, state);
          }
        }
        this.logger.info('Connection states loaded successfully');
      }
    } catch (error) {
      this.logger.error('Failed to load connection states:', error);
    }
  }

  async saveConnectionStates() {
    const statePath = path.join(__dirname, '..', 'config', 'connection.states.json');
    const states = {};
    
    for (const [id, connection] of this.activeConnections.entries()) {
      states[id] = {
        id,
        type: connection.type,
        enabled: connection.enabled,
        autoReconnect: connection.autoReconnect,
        reconnectDelay: connection.reconnectDelay,
        lastActivity: connection.lastActivity,
        createdAt: connection.createdAt
      };
    }
    
    try {
      await fs.writeJSON(statePath, states, { spaces: 2 });
    } catch (error) {
      this.logger.error('Failed to save connection states:', error);
    }
  }

  // SSH Tunnel Management
  async createSSHTunnel(config) {
    const connectionId = crypto.randomUUID();
    
    try {
      const ssh = new NodeSSH();
      
      const sshConfig = {
        host: config.host,
        port: config.port || 22,
        username: config.username,
        // Use private key if provided, otherwise use password
        privateKey: config.privateKey ? 
          await fs.readFile(config.privateKey, 'utf8') : 
          undefined,
        password: config.password || undefined,
        readyTimeout: 10000,
        tryKeyboard: false,
        keepaliveInterval: 60000,
        keepaliveCountMax: 3
      };

      this.logger.info(`Creating SSH tunnel to ${config.host}:${config.port}`);
      
      await ssh.connect(sshConfig);

      // Create port forwarding
      const tunnelConfig = {
        host: config.remoteHost || 'localhost',
        port: config.remotePort || 80,
        localHost: config.localHost || '127.0.0.1',
        localPort: config.localPort || 1080
      };

      const server = await ssh.forwardOutbound(
        tunnelConfig.localHost,
        tunnelConfig.localPort,
        tunnelConfig.host,
        tunnelConfig.port
      );

      const connection = {
        id: connectionId,
        type: 'ssh-tunnel',
        name: config.name || 'SSH Tunnel',
        ssh,
        server,
        config: tunnelConfig,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'connected',
        bytesTransferred: 0
      };

      this.activeConnections.set(connectionId, connection);
      this.stats.activeConnections = this.activeConnections.size;
      this.stats.totalConnections++;

      // Monitor connection
      this.monitorConnection(connectionId, connection);

      this.emit('connectionCreated', connection);
      this.logger.info(`SSH tunnel created successfully: ${connectionId}`);

      return {
        success: true,
        connectionId,
        message: 'SSH tunnel created successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to create SSH tunnel: ${error.message}`);
      
      if (config.autoReconnect) {
        this.scheduleReconnect(connectionId, config);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // HTTP Proxy Management
  async createHTTPProxy(config) {
    const connectionId = crypto.randomUUID();
    
    try {
      const http = require('http');
      const net = require('net');

      const server = http.createServer((req, res) => {
        this.handleProxyRequest(req, res, config);
      });

      // Handle CONNECT method for HTTPS tunneling
      server.on('connect', (req, clientSocket, head) => {
        this.handleCONNECT(clientSocket, req, head, config);
      });

      await new Promise((resolve, reject) => {
        server.listen(config.port || 8080, config.bindAddress || '127.0.0.1', resolve);
        server.on('error', reject);
      });

      const connection = {
        id: connectionId,
        type: 'http-proxy',
        name: config.name || 'HTTP Proxy',
        server,
        config: {
          port: config.port || 8080,
          bindAddress: config.bindAddress || '127.0.0.1',
          username: config.username || '',
          password: config.password || '',
          authRequired: !!config.username
        },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        status: 'running',
        bytesTransferred: 0
      };

      this.activeConnections.set(connectionId, connection);
      this.stats.activeConnections = this.activeConnections.size;
      this.stats.totalConnections++;

      this.emit('connectionCreated', connection);
      this.logger.info(`HTTP proxy created successfully: ${connectionId}`);

      return {
        success: true,
        connectionId,
        message: 'HTTP proxy created successfully'
      };

    } catch (error) {
      this.logger.error(`Failed to create HTTP proxy: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  handleProxyRequest(req, res, config) {
    try {
      const url = new URL(req.url);
      const targetUrl = `http://${url.hostname}:${url.port || 80}${url.pathname}${url.search}`;
      
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        method: req.method,
        headers: req.headers,
        path: url.pathname + url.search
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        proxyReq.pipe(proxyRes);
      });

      proxyReq.on('error', (error) => {
        this.logger.error('Proxy request error:', error);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway');
      });

      req.pipe(proxyReq);
      
      // Update stats
      this.stats.bytesTransferred += req.headers['content-length'] || 0;
      
    } catch (error) {
      this.logger.error('Proxy request handling error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  handleCONNECT(clientSocket, req, head, config) {
    // Basic CONNECT handling for HTTPS tunneling
    // This is a simplified implementation
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    clientSocket.pipe(clientSocket); // Simple passthrough
    
    this.logger.info(`CONNECT request: ${req.url}`);
  }

  // Connection Monitoring
  monitorConnection(connectionId, connection) {
    // Check connection health every 30 seconds
    const interval = setInterval(async () => {
      try {
        if (connection.type === 'ssh-tunnel') {
          const isAlive = await this.checkSSHConnection(connection.ssh);
          if (!isAlive) {
            this.logger.warn(`SSH connection lost: ${connectionId}`);
            await this.closeConnection(connectionId);
            
            if (connection.autoReconnect) {
              this.scheduleReconnect(connectionId, connection.config);
            }
          }
        }
        
        // Update last activity
        connection.lastActivity = Date.now();
        
      } catch (error) {
        this.logger.error(`Connection monitoring error (${connectionId}):`, error);
      }
    }, 30000);

    connection.monitorInterval = interval;
  }

  async checkSSHConnection(ssh) {
    try {
      await ssh.execCommand('echo "ping"');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Auto-reconnection
  scheduleReconnect(connectionId, config) {
    const delay = config.reconnectDelay || 5000;
    
    if (this.reconnectIntervals.has(connectionId)) {
      clearTimeout(this.reconnectIntervals.get(connectionId));
    }

    const timeout = setTimeout(async () => {
      try {
        this.logger.info(`Attempting to reconnect: ${connectionId}`);
        
        if (config.type === 'ssh') {
          await this.createSSHTunnel(config);
        } else if (config.type === 'http') {
          await this.createHTTPProxy(config);
        }
        
      } catch (error) {
        this.logger.error(`Reconnection failed (${connectionId}):`, error);
        
        // Schedule next reconnection attempt
        if (config.autoReconnect) {
          this.scheduleReconnect(connectionId, config);
        }
      }
    }, delay);

    this.reconnectIntervals.set(connectionId, timeout);
  }

  // Connection Management
  async closeConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    try {
      // Clear monitoring
      if (connection.monitorInterval) {
        clearInterval(connection.monitorInterval);
      }

      // Clear reconnection
      if (this.reconnectIntervals.has(connectionId)) {
        clearTimeout(this.reconnectIntervals.get(connectionId));
        this.reconnectIntervals.delete(connectionId);
      }

      // Close connection based on type
      if (connection.type === 'ssh-tunnel') {
        if (connection.server) {
          connection.server.close();
        }
        if (connection.ssh) {
          connection.ssh.dispose();
        }
      } else if (connection.type === 'http-proxy') {
        if (connection.server) {
          connection.server.close();
        }
      }

      this.activeConnections.delete(connectionId);
      this.stats.activeConnections = this.activeConnections.size;

      this.emit('connectionClosed', connection);
      this.logger.info(`Connection closed: ${connectionId}`);

      // Save state
      await this.saveConnectionStates();

      return { success: true, message: 'Connection closed successfully' };

    } catch (error) {
      this.logger.error(`Failed to close connection (${connectionId}):`, error);
      return { success: false, error: error.message };
    }
  }

  // Configuration Management
  async addTunnel(tunnelConfig) {
    try {
      const tunnel = {
        id: crypto.randomUUID(),
        name: tunnelConfig.name || 'New Tunnel',
        type: 'ssh',
        enabled: true,
        autoReconnect: true,
        reconnectDelay: 5000,
        config: tunnelConfig
      };

      this.config.tunnels.push(tunnel);
      await this.saveConfiguration();

      this.logger.info(`Tunnel added: ${tunnel.id}`);
      return { success: true, id: tunnel.id, message: 'Tunnel added successfully' };

    } catch (error) {
      this.logger.error('Failed to add tunnel:', error);
      return { success: false, error: error.message };
    }
  }

  async removeTunnel(tunnelId) {
    try {
      // Close active connection if exists
      const activeConnection = Array.from(this.activeConnections.values())
        .find(conn => conn.config?.tunnelId === tunnelId);
      
      if (activeConnection) {
        await this.closeConnection(activeConnection.id);
      }

      // Remove from configuration
      this.config.tunnels = this.config.tunnels.filter(t => t.id !== tunnelId);
      await this.saveConfiguration();

      this.logger.info(`Tunnel removed: ${tunnelId}`);
      return { success: true, message: 'Tunnel removed successfully' };

    } catch (error) {
      this.logger.error('Failed to remove tunnel:', error);
      return { success: false, error: error.message };
    }
  }

  async startTunnel(tunnelId) {
    const tunnel = this.config.tunnels.find(t => t.id === tunnelId);
    if (!tunnel) {
      return { success: false, error: 'Tunnel not found' };
    }

    try {
      const result = await this.createSSHTunnel({
        ...tunnel.config,
        name: tunnel.name,
        autoReconnect: tunnel.autoReconnect,
        reconnectDelay: tunnel.reconnectDelay
      });

      if (result.success) {
        this.activeConnections.get(result.connectionId).config.tunnelId = tunnelId;
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to start tunnel (${tunnelId}):`, error);
      return { success: false, error: error.message };
    }
  }

  async stopTunnel(tunnelId) {
    const connection = Array.from(this.activeConnections.values())
      .find(conn => conn.config?.tunnelId === tunnelId);
    
    if (!connection) {
      return { success: false, error: 'Tunnel not running' };
    }

    return await this.closeConnection(connection.id);
  }

  // Status and Statistics
  getStatus() {
    return {
      stats: this.stats,
      activeConnections: Array.from(this.activeConnections.values()).map(conn => ({
        id: conn.id,
        name: conn.name,
        type: conn.type,
        status: conn.status,
        createdAt: conn.createdAt,
        lastActivity: conn.lastActivity,
        bytesTransferred: conn.bytesTransferred
      })),
      configuredTunnels: this.config.tunnels.map(tunnel => ({
        id: tunnel.id,
        name: tunnel.name,
        enabled: tunnel.enabled,
        autoReconnect: tunnel.autoReconnect,
        status: Array.from(this.activeConnections.values())
          .find(conn => conn.config?.tunnelId === tunnel.id) ? 'running' : 'stopped'
      }))
    };
  }

  getConnectionDetails(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return null;
    }

    return {
      ...connection,
      // Remove sensitive data
      ssh: connection.ssh ? '[SSH Connection]' : undefined,
      server: connection.server ? '[Server]' : undefined
    };
  }

  // Cleanup and Shutdown
  async shutdown() {
    this.logger.info('Shutting down VPN Service...');
    
    // Close all connections
    const closePromises = Array.from(this.activeConnections.keys())
      .map(id => this.closeConnection(id));
    
    await Promise.allSettled(closePromises);
    
    // Clear all intervals
    for (const interval of this.reconnectIntervals.values()) {
      clearTimeout(interval);
    }
    this.reconnectIntervals.clear();
    
    // Save final state
    await this.saveConnectionStates();
    
    this.logger.info('VPN Service shutdown complete');
  }
}

module.exports = VPNService;