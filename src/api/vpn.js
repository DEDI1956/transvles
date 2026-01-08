const express = require('express');
const { body, validationResult, param } = require('express-validator');
const VPNService = require('../services/VPNService');

const router = express.Router();

// Middleware to extract VPN service from app locals
const getVPNService = (req) => {
  return req.app.locals.vpnService;
};

// Apply VPN service to all routes
router.use((req, res, next) => {
  if (!req.app.locals.vpnService) {
    req.app.locals.vpnService = new VPNService(req.app.locals.logger);
  }
  next();
});

/**
 * @route   GET /api/v1/vpn/status
 * @desc    Get VPN service status and statistics
 * @access  Private
 */
router.get('/status', (req, res) => {
  try {
    const vpnService = getVPNService(req);
    const status = vpnService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get VPN status error:', error);
    res.status(500).json({
      error: 'Failed to get VPN status',
      code: 'VPN_STATUS_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/vpn/connections
 * @desc    Get all active connections
 * @access  Private
 */
router.get('/connections', (req, res) => {
  try {
    const vpnService = getVPNService(req);
    const status = vpnService.getStatus();
    
    res.json({
      success: true,
      data: {
        connections: status.activeConnections,
        total: status.activeConnections.length
      }
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      error: 'Failed to get connections',
      code: 'CONNECTIONS_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/vpn/connections/:id
 * @desc    Get specific connection details
 * @access  Private
 */
router.get('/connections/:id',
  [
    param('id').isUUID().withMessage('Valid connection ID is required')
  ],
  (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const connectionId = req.params.id;
      const connection = vpnService.getConnectionDetails(connectionId);
      
      if (!connection) {
        return res.status(404).json({
          error: 'Connection not found',
          code: 'CONNECTION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: connection
      });
    } catch (error) {
      console.error('Get connection details error:', error);
      res.status(500).json({
        error: 'Failed to get connection details',
        code: 'CONNECTION_DETAILS_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/vpn/tunnels
 * @desc    Create new SSH tunnel
 * @access  Private
 */
router.post('/tunnels',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required and must be less than 100 characters'),
    body('host')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Host is required'),
    body('port')
      .isInt({ min: 1, max: 65535 })
      .withMessage('Port must be between 1 and 65535'),
    body('username')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Username is required'),
    body('password')
      .optional()
      .isLength({ min: 0 })
      .withMessage('Password must be a string'),
    body('privateKey')
      .optional()
      .isLength({ min: 0 })
      .withMessage('Private key must be a string'),
    body('localPort')
      .isInt({ min: 1024, max: 65535 })
      .withMessage('Local port must be between 1024 and 65535'),
    body('remotePort')
      .isInt({ min: 1, max: 65535 })
      .withMessage('Remote port must be between 1 and 65535'),
    body('remoteHost')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Remote host must be a string'),
    body('localHost')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Local host must be a string'),
    body('autoReconnect')
      .optional()
      .isBoolean()
      .withMessage('AutoReconnect must be a boolean'),
    body('reconnectDelay')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('Reconnect delay must be between 1000 and 300000 milliseconds'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const tunnelConfig = {
        name: req.body.name,
        host: req.body.host,
        port: req.body.port,
        username: req.body.username,
        password: req.body.password,
        privateKey: req.body.privateKey,
        localPort: req.body.localPort,
        remotePort: req.body.remotePort,
        remoteHost: req.body.remoteHost || 'localhost',
        localHost: req.body.localHost || '127.0.0.1',
        autoReconnect: req.body.autoReconnect !== false, // default true
        reconnectDelay: req.body.reconnectDelay || 5000
      };

      const result = await vpnService.addTunnel(tunnelConfig);
      
      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: 'TUNNEL_CREATION_FAILED'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Tunnel created successfully',
        data: {
          tunnelId: result.id,
          name: tunnelConfig.name
        }
      });

    } catch (error) {
      console.error('Create tunnel error:', error);
      res.status(500).json({
        error: 'Failed to create tunnel',
        code: 'TUNNEL_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/vpn/tunnels/:id/start
 * @desc    Start a tunnel
 * @access  Private
 */
router.post('/tunnels/:id/start',
  [
    param('id').isUUID().withMessage('Valid tunnel ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const tunnelId = req.params.id;
      
      const result = await vpnService.startTunnel(tunnelId);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({
          error: result.error,
          code: 'TUNNEL_START_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Tunnel started successfully',
        data: {
          tunnelId,
          connectionId: result.connectionId
        }
      });

    } catch (error) {
      console.error('Start tunnel error:', error);
      res.status(500).json({
        error: 'Failed to start tunnel',
        code: 'TUNNEL_START_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/vpn/tunnels/:id/stop
 * @desc    Stop a tunnel
 * @access  Private
 */
router.post('/tunnels/:id/stop',
  [
    param('id').isUUID().withMessage('Valid tunnel ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const tunnelId = req.params.id;
      
      const result = await vpnService.stopTunnel(tunnelId);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({
          error: result.error,
          code: 'TUNNEL_STOP_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Tunnel stopped successfully',
        data: { tunnelId }
      });

    } catch (error) {
      console.error('Stop tunnel error:', error);
      res.status(500).json({
        error: 'Failed to stop tunnel',
        code: 'TUNNEL_STOP_ERROR'
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/vpn/tunnels/:id
 * @desc    Remove a tunnel configuration
 * @access  Private
 */
router.delete('/tunnels/:id',
  [
    param('id').isUUID().withMessage('Valid tunnel ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const tunnelId = req.params.id;
      
      const result = await vpnService.removeTunnel(tunnelId);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({
          error: result.error,
          code: 'TUNNEL_REMOVAL_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Tunnel removed successfully',
        data: { tunnelId }
      });

    } catch (error) {
      console.error('Remove tunnel error:', error);
      res.status(500).json({
        error: 'Failed to remove tunnel',
        code: 'TUNNEL_REMOVAL_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/vpn/proxies
 * @desc    Create new HTTP proxy
 * @access  Private
 */
router.post('/proxies',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required and must be less than 100 characters'),
    body('port')
      .isInt({ min: 1024, max: 65535 })
      .withMessage('Port must be between 1024 and 65535'),
    body('bindAddress')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Bind address must be a string'),
    body('username')
      .optional()
      .trim()
      .isLength({ min: 0 })
      .withMessage('Username must be a string'),
    body('password')
      .optional()
      .trim()
      .isLength({ min: 0 })
      .withMessage('Password must be a string'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const proxyConfig = {
        name: req.body.name,
        port: req.body.port,
        bindAddress: req.body.bindAddress || '127.0.0.1',
        username: req.body.username || '',
        password: req.body.password || ''
      };

      const result = await vpnService.createHTTPProxy(proxyConfig);
      
      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          code: 'PROXY_CREATION_FAILED'
        });
      }

      res.status(201).json({
        success: true,
        message: 'HTTP proxy created successfully',
        data: {
          proxyId: result.connectionId,
          name: proxyConfig.name,
          port: proxyConfig.port
        }
      });

    } catch (error) {
      console.error('Create proxy error:', error);
      res.status(500).json({
        error: 'Failed to create proxy',
        code: 'PROXY_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/vpn/connections/:id/close
 * @desc    Close specific connection
 * @access  Private
 */
router.post('/connections/:id/close',
  [
    param('id').isUUID().withMessage('Valid connection ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const vpnService = getVPNService(req);
      const connectionId = req.params.id;
      
      const result = await vpnService.closeConnection(connectionId);
      
      if (!result.success) {
        const statusCode = result.error.includes('not found') ? 404 : 400;
        return res.status(statusCode).json({
          error: result.error,
          code: 'CONNECTION_CLOSE_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Connection closed successfully',
        data: { connectionId }
      });

    } catch (error) {
      console.error('Close connection error:', error);
      res.status(500).json({
        error: 'Failed to close connection',
        code: 'CONNECTION_CLOSE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/vpn/stats
 * @desc    Get VPN statistics
 * @access  Private
 */
router.get('/stats', (req, res) => {
  try {
    const vpnService = getVPNService(req);
    const status = vpnService.getStatus();
    
    res.json({
      success: true,
      data: {
        statistics: status.stats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get VPN stats error:', error);
    res.status(500).json({
      error: 'Failed to get VPN statistics',
      code: 'VPN_STATS_ERROR'
    });
  }
});

module.exports = router;