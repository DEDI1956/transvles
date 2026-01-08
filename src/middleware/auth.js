const jwt = require('jsonwebtoken');

/**
 * Authentication middleware to verify JWT tokens
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'zivpn-secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }

    req.user = user;
    next();
  });
};

/**
 * Middleware to check if user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware to check if user has specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: `Permission '${permission}' required`,
        code: 'PERMISSION_REQUIRED'
      });
    }

    next();
  };
};

/**
 * Middleware to validate request content type
 */
const requireJSON = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }
  }
  next();
};

/**
 * Middleware to log API requests
 */
const logRequest = (logger) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Log request
    logger.info('API Request', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - start;
      
      // Log response
      logger.info('API Response', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id || 'anonymous'
      });

      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Middleware to handle CORS preflight requests
 */
const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
    return res.status(204).end();
  }
  next();
};

/**
 * Middleware to sanitize input
 */
const sanitizeInput = (req, res, next) => {
  // Remove null bytes and control characters
  const sanitize = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove null bytes and control characters
        obj[key] = obj[key].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        // Trim excessive whitespace
        obj[key] = obj[key].trim().replace(/\s+/g, ' ');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitize(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    sanitize(req.query);
  }

  next();
};

/**
 * Middleware to add security headers
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:");
  
  next();
};

/**
 * Middleware to handle rate limiting per user
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [id, data] of userRequests.entries()) {
      if (data.resetTime <= now) {
        userRequests.delete(id);
      }
    }

    // Check current user's requests
    if (!userRequests.has(userId)) {
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    const userData = userRequests.get(userId);
    
    if (userData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      });
    }

    userData.count++;
    next();
  };
};

/**
 * Middleware to validate API version
 */
const validateAPIVersion = (req, res, next) => {
  const apiVersion = req.headers['api-version'] || 'v1';
  
  if (!apiVersion.startsWith('v')) {
    return res.status(400).json({
      error: 'Invalid API version format',
      code: 'INVALID_API_VERSION'
    });
  }

  // Add version to request for use in route handlers
  req.apiVersion = apiVersion;
  next();
};

/**
 * Error handling middleware
 */
const errorHandler = (logger) => {
  return (err, req, res, next) => {
    // Log error
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      userId: req.user?.id || 'anonymous',
      ip: req.ip
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      error: isDevelopment ? err.message : 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      ...(isDevelopment && { stack: err.stack })
    });
  };
};

/**
 * 404 handler
 */
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireJSON,
  logRequest,
  handlePreflight,
  sanitizeInput,
  securityHeaders,
  userRateLimit,
  validateAPIVersion,
  errorHandler,
  notFound
};