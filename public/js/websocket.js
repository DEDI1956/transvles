// ZiVPN Manager - WebSocket Manager
class WebSocketManager {
    constructor(apiClient) {
        this.api = apiClient;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.subscriptions = new Set();
        this.eventListeners = new Map();
        this.messageQueue = [];
        this.lastPingTime = 0;
        this.pingTimeout = 30000; // 30 seconds
        
        this.init();
    }

    init() {
        this.connect();
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsURL = `${protocol}//${window.location.host}/ws`;
            
            // Add authentication token
            const token = this.api.token;
            const wsURLWithAuth = token ? `${wsURL}?token=${encodeURIComponent(token)}` : wsURL;
            
            this.ws = new WebSocket(wsURLWithAuth);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    handleOpen(event) {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Send any queued messages
        this.processMessageQueue();
        
        // Resubscribe to channels
        this.resubscribe();
        
        // Notify listeners
        this.emit('connected', event);
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.handleWSMessage(message);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    handleWSMessage(message) {
        switch (message.type) {
            case 'pong':
                this.handlePong(message);
                break;
            case 'status_update':
                this.emit('status_update', message.data);
                break;
            case 'connection_created':
                this.emit('connection_created', message.data);
                break;
            case 'connection_closed':
                this.emit('connection_closed', message.data);
                break;
            case 'connections_update':
                this.emit('connections_update', message.data);
                break;
            case 'logs':
                this.emit('logs', message.data);
                break;
            case 'error':
                this.emit('error', message.error);
                break;
            case 'command_result':
                this.emit('command_result', message.data);
                break;
            case 'subscription_confirmed':
                console.log('Subscription confirmed:', message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    handleClose(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Don't reconnect if it was a clean close
        if (event.code === 1000) {
            this.emit('disconnected', event);
            return;
        }
        
        this.scheduleReconnect();
        this.emit('disconnected', event);
    }

    handleError(error) {
        console.error('WebSocket error:', error);
        this.emit('error', error);
    }

    handlePong(message) {
        const now = Date.now();
        const latency = now - this.lastPingTime;
        this.emit('pong', { timestamp: message.timestamp, latency });
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('max_reconnect_attempts_reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, this.pingTimeout);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    resubscribe() {
        if (this.subscriptions.size > 0) {
            this.subscribe(Array.from(this.subscriptions));
        }
    }

    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
                this.messageQueue.push(message); // Queue for retry
            }
        } else {
            this.messageQueue.push(message); // Queue for retry
        }
    }

    // Public API Methods
    subscribe(channels) {
        if (!Array.isArray(channels)) {
            channels = [channels];
        }
        
        channels.forEach(channel => this.subscriptions.add(channel));
        
        this.send({
            type: 'subscribe',
            data: { channels }
        });
    }

    unsubscribe(channels) {
        if (!Array.isArray(channels)) {
            channels = [channels];
        }
        
        channels.forEach(channel => this.subscriptions.delete(channel));
        
        this.send({
            type: 'unsubscribe',
            data: { channels }
        });
    }

    requestStatus() {
        this.send({ type: 'get_status' });
    }

    requestConnections() {
        this.send({ type: 'get_connections' });
    }

    requestLogs(params = {}) {
        this.send({
            type: 'get_logs',
            data: params
        });
    }

    executeCommand(command, params = {}) {
        this.send({
            type: 'execute_command',
            data: { command, params }
        });
    }

    // Event System
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Connection Management
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        this.stopHeartbeat();
        this.isConnected = false;
    }

    reconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        setTimeout(() => this.connect(), 1000);
    }

    // Status and Utilities
    getConnectionState() {
        if (!this.ws) return 'disconnected';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
                return 'closing';
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'unknown';
        }
    }

    isHealthy() {
        return this.isConnected && this.ws.readyState === WebSocket.OPEN;
    }

    getStats() {
        return {
            connected: this.isConnected,
            connectionState: this.getConnectionState(),
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.subscriptions.size,
            queuedMessages: this.messageQueue.length
        };
    }

    destroy() {
        this.disconnect();
        this.eventListeners.clear();
        this.subscriptions.clear();
        this.messageQueue = [];
    }
}