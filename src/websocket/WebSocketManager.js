const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const EventEmitter = require('eventemitter3');

class WebSocketManager extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.clients = new Map();
    this.server = null;
    this.heartbeatInterval = null;
    this.rateLimits = new Map();
  }

  initialize(server) {
    this.server = server;
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      clientTracking: false,
      perMessageDeflate: {
        zlibDeflateOptions: {
          threshold: 1024,
        },
        maxPayload: 16 * 1024 * 1024 // 16MB
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));
    
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
    
    this.logger.info('WebSocket manager initialized');
  }

  handleConnection(ws, req) {
    try {
      // Parse query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const clientId = url.searchParams.get('clientId') || this.generateClientId();

      // Validate token (if provided)
      if (token && !this.validateToken(token)) {
        ws.close(4001, 'Invalid token');
        return;
      }

      // Rate limiting
      if (this.isRateLimited(req.socket.remoteAddress)) {
        ws.close(4002, 'Rate limit exceeded');
        return;
      }

      const clientInfo = {
        id: clientId,
        ws,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        subscriptions: new Set()
      };

      this.clients.set(clientId, clientInfo);
      
      this.logger.info(`WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

      // Handle messages from client
      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        this.handleDisconnection(clientId, code, reason);
      });

      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection_established',
        data: {
          clientId,
          timestamp: Date.now(),
          serverVersion: '1.0.0'
        }
      });

      // Send current status
      this.sendStatusUpdate(clientId);

      // Emit connection event
      this.emit('clientConnected', clientId, clientInfo);

    } catch (error) {
      this.logger.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      client.lastActivity = Date.now();

      // Parse message
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        this.sendToClient(clientId, {
          type: 'error',
          error: 'Invalid JSON message'
        });
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;

        case 'get_status':
          this.sendStatusUpdate(clientId);
          break;

        case 'get_connections':
          this.sendConnectionsUpdate(clientId);
          break;

        case 'get_logs':
          this.sendLogs(clientId, message.data);
          break;

        case 'execute_command':
          this.handleCommand(clientId, message.data);
          break;

        default:
          this.sendToClient(clientId, {
            type: 'error',
            error: `Unknown message type: ${message.type}`
          });
      }

      this.emit('messageReceived', clientId, message);

    } catch (error) {
      this.logger.error(`Error handling WebSocket message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Message processing failed'
      });
    }
  }

  handleSubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    
    if (Array.isArray(channels)) {
      channels.forEach(channel => {
        client.subscriptions.add(channel);
      });
      
      this.logger.info(`Client ${clientId} subscribed to: ${Array.from(channels).join(', ')}`);
      
      this.sendToClient(clientId, {
        type: 'subscription_confirmed',
        data: { channels: Array.from(channels) }
      });
    }
  }

  handleUnsubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    
    if (Array.isArray(channels)) {
      channels.forEach(channel => {
        client.subscriptions.delete(channel);
      });
      
      this.logger.info(`Client ${clientId} unsubscribed from: ${Array.from(channels).join(', ')}`);
    }
  }

  async handleCommand(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const { command, params } = data;
      
      // Emit command event for VPN service to handle
      const result = await this.emit('commandReceived', clientId, command, params);
      
      if (result) {
        this.sendToClient(clientId, {
          type: 'command_result',
          data: { command, result, timestamp: Date.now() }
        });
      } else {
        this.sendToClient(clientId, {
          type: 'command_error',
          error: 'Command not supported or failed',
          data: { command }
        });
      }

    } catch (error) {
      this.logger.error(`Command execution error for client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'command_error',
        error: error.message,
        data: { command: data.command }
      });
    }
  }

  handleDisconnection(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      this.logger.info(`WebSocket client disconnected: ${clientId} (${code}: ${reason})`);
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId, code, reason);
    }
  }

  handleError(error) {
    this.logger.error('WebSocket server error:', error);
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      client.ws.send(messageStr);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  broadcast(message, filter = null) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(clientId);
        continue;
      }

      // Apply filter if provided
      if (filter && !filter(clientId, client)) {
        continue;
      }

      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }

  sendStatusUpdate(clientId = null) {
    const statusMessage = {
      type: 'status_update',
      data: {
        timestamp: Date.now(),
        clients: this.clients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        ...this.emit('getStatus')[0] // Get status from VPN service
      }
    };

    if (clientId) {
      this.sendToClient(clientId, statusMessage);
    } else {
      this.broadcast(statusMessage);
    }
  }

  sendConnectionsUpdate(clientId = null) {
    const connectionsMessage = {
      type: 'connections_update',
      data: {
        timestamp: Date.now(),
        connections: this.emit('getConnections')[0] || []
      }
    };

    if (clientId) {
      this.sendToClient(clientId, connectionsMessage);
    } else {
      this.broadcast(connectionsMessage);
    }
  }

  sendLogs(clientId, data = {}) {
    // This would typically fetch logs from a logging service
    // For now, we'll send a mock log message
    const logsMessage = {
      type: 'logs',
      data: {
        timestamp: Date.now(),
        logs: [
          {
            level: 'info',
            message: 'Log system initialized',
            timestamp: Date.now()
          }
        ],
        ...data
      }
    };

    this.sendToClient(clientId, logsMessage);
  }

  // Utility methods
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zivpn-secret');
      return decoded.exp > Date.now() / 1000;
    } catch (error) {
      return false;
    }
  }

  isRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxConnections = 10; // max connections per minute per IP

    if (!this.rateLimits.has(ip)) {
      this.rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
      return false;
    }

    const limit = this.rateLimits.get(ip);
    
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return false;
    }

    if (limit.count >= maxConnections) {
      return true;
    }

    limit.count++;
    return false;
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients.entries()) {
        // Check if client is still alive
        if (now - client.lastActivity > 30000) { // 30 seconds timeout
          this.logger.warn(`Client ${clientId} timed out, closing connection`);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        // Send ping to client
        this.sendToClient(clientId, {
          type: 'ping',
          timestamp: now
        });
      }
    }, 10000); // Every 10 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Statistics
  getStats() {
    return {
      connectedClients: this.clients.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      totalMessagesSent: this.clients.size > 0 ? 
        Array.from(this.clients.values()).reduce((sum, client) => 
          sum + (client.messagesSent || 0), 0) : 0
    };
  }

  // Cleanup
  close() {
    this.stopHeartbeat();
    
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close(1000, 'Server shutting down');
    }
    
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.logger.info('WebSocket manager closed');
  }
}

module.exports = WebSocketManager;