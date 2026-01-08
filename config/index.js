const fs = require('fs');
const path = require('path');

module.exports = {
  // Express configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'zivpn-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'zivpn-refresh-secret',
  sessionSecret: process.env.SESSION_SECRET || 'zivpn-session-secret',
  
  // API Configuration
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // VPN Service Configuration
  maxConnections: parseInt(process.env.VPN_MAX_CONNECTIONS) || 100,
  defaultReconnectDelay: parseInt(process.env.VPN_DEFAULT_RECONNECT_DELAY) || 5000,
  connectionTimeout: parseInt(process.env.VPN_CONNECTION_TIMEOUT) || 30000,
  
  // SSH Configuration
  ssh: {
    defaultPort: parseInt(process.env.SSH_DEFAULT_PORT) || 22,
    connectionTimeout: parseInt(process.env.SSH_CONNECTION_TIMEOUT) || 10000,
    keepAliveInterval: parseInt(process.env.SSH_KEEPALIVE_INTERVAL) || 60000,
    keepAliveCountMax: parseInt(process.env.SSH_KEEPALIVE_COUNT_MAX) || 3
  },
  
  // Proxy Configuration
  proxy: {
    defaultPort: parseInt(process.env.PROXY_DEFAULT_PORT) || 8080,
    enableAuth: process.env.PROXY_ENABLE_AUTH === 'true',
    enableLogging: process.env.PROXY_ENABLE_LOGGING !== 'false'
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.LOG_ENABLE_FILE_LOGGING !== 'false',
    logDirectory: path.join(__dirname, '..', 'logs'),
    maxFiles: 5,
    maxSize: '10m'
  },
  
  // WebSocket Configuration
  websocket: {
    enabled: process.env.ENABLE_WEBSOCKET !== 'false',
    path: '/ws',
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS) || 1000
  },
  
  // Database Configuration (optional)
  database: {
    url: process.env.DATABASE_URL || null,
    ssl: process.env.DATABASE_SSL === 'true'
  },
  
  // Redis Configuration (optional)
  redis: {
    url: process.env.REDIS_URL || null,
    ttl: parseInt(process.env.REDIS_TTL) || 86400 // 24 hours
  },
  
  // Email Configuration (optional)
  email: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'ZiVPN Manager <noreply@localhost>'
  },
  
  // Feature Flags
  features: {
    enableProxy: process.env.ENABLE_PROXY !== 'false',
    enableTunneling: process.env.ENABLE_TUNNELING !== 'false',
    enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false'
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : (process.env.NODE_ENV === 'production' ? false : true),
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Security Headers
  security: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false
  },
  
  // Health Check Configuration
  healthCheck: {
    enabled: true,
    path: '/health',
    timeout: 5000
  },
  
  // Development Configuration
  development: {
    enabled: process.env.NODE_ENV !== 'production',
    verbose: process.env.VERBOSE_LOGGING === 'true',
    debug: process.env.DEBUG === 'true'
  }
};