const express = require('express');
const { body, validationResult, param } = require('express-validator');

const router = express.Router();

// In-memory configuration storage (in production, use proper database)
let configuration = {
  global: {
    enableLogging: true,
    logLevel: 'info',
    maxConnections: 100,
    defaultReconnectDelay: 5000,
    enableMetrics: true
  },
  security: {
    enableRateLimit: true,
    maxRequestsPerMinute: 60,
    enableCors: true,
    allowedOrigins: ['*']
  },
  ssh: {
    defaultPort: 22,
    connectionTimeout: 10000,
    keepAliveInterval: 60000,
    keepAliveCountMax: 3
  },
  proxy: {
    defaultPort: 8080,
    enableAuth: false,
    enableLogging: true
  }
};

/**
 * @route   GET /api/v1/config
 * @desc    Get current configuration
 * @access  Private
 */
router.get('/', (req, res) => {
  try {
    // Don't expose sensitive data
    const safeConfig = {
      ...configuration,
      // Remove any sensitive fields
      security: {
        ...configuration.security,
        // Remove actual secrets
      }
    };

    res.json({
      success: true,
      data: safeConfig
    });
  } catch (error) {
    console.error('Get configuration error:', error);
    res.status(500).json({
      error: 'Failed to get configuration',
      code: 'CONFIG_GET_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/config/global
 * @desc    Get global configuration
 * @access  Private
 */
router.get('/global', (req, res) => {
  try {
    res.json({
      success: true,
      data: configuration.global
    });
  } catch (error) {
    console.error('Get global config error:', error);
    res.status(500).json({
      error: 'Failed to get global configuration',
      code: 'GLOBAL_CONFIG_ERROR'
    });
  }
});

/**
 * @route   PUT /api/v1/config/global
 * @desc    Update global configuration
 * @access  Private (Admin only)
 */
router.put('/global',
  [
    body('enableLogging')
      .optional()
      .isBoolean()
      .withMessage('enableLogging must be a boolean'),
    body('logLevel')
      .optional()
      .isIn(['error', 'warn', 'info', 'debug'])
      .withMessage('logLevel must be one of: error, warn, info, debug'),
    body('maxConnections')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('maxConnections must be between 1 and 1000'),
    body('defaultReconnectDelay')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('defaultReconnectDelay must be between 1000 and 300000 milliseconds'),
    body('enableMetrics')
      .optional()
      .isBoolean()
      .withMessage('enableMetrics must be a boolean'),
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

      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Update configuration
      Object.keys(req.body).forEach(key => {
        if (configuration.global.hasOwnProperty(key)) {
          configuration.global[key] = req.body[key];
        }
      });

      res.json({
        success: true,
        message: 'Global configuration updated successfully',
        data: configuration.global
      });

    } catch (error) {
      console.error('Update global config error:', error);
      res.status(500).json({
        error: 'Failed to update global configuration',
        code: 'GLOBAL_CONFIG_UPDATE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/config/security
 * @desc    Get security configuration
 * @access  Private (Admin only)
 */
router.get('/security', (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    res.json({
      success: true,
      data: configuration.security
    });
  } catch (error) {
    console.error('Get security config error:', error);
    res.status(500).json({
      error: 'Failed to get security configuration',
      code: 'SECURITY_CONFIG_ERROR'
    });
  }
});

/**
 * @route   PUT /api/v1/config/security
 * @desc    Update security configuration
 * @access  Private (Admin only)
 */
router.put('/security',
  [
    body('enableRateLimit')
      .optional()
      .isBoolean()
      .withMessage('enableRateLimit must be a boolean'),
    body('maxRequestsPerMinute')
      .optional()
      .isInt({ min: 10, max: 1000 })
      .withMessage('maxRequestsPerMinute must be between 10 and 1000'),
    body('enableCors')
      .optional()
      .isBoolean()
      .withMessage('enableCors must be a boolean'),
    body('allowedOrigins')
      .optional()
      .isArray()
      .withMessage('allowedOrigins must be an array'),
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

      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Update security configuration
      Object.keys(req.body).forEach(key => {
        if (configuration.security.hasOwnProperty(key)) {
          configuration.security[key] = req.body[key];
        }
      });

      res.json({
        success: true,
        message: 'Security configuration updated successfully',
        data: configuration.security
      });

    } catch (error) {
      console.error('Update security config error:', error);
      res.status(500).json({
        error: 'Failed to update security configuration',
        code: 'SECURITY_CONFIG_UPDATE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/config/ssh
 * @desc    Get SSH configuration
 * @access  Private
 */
router.get('/ssh', (req, res) => {
  try {
    res.json({
      success: true,
      data: configuration.ssh
    });
  } catch (error) {
    console.error('Get SSH config error:', error);
    res.status(500).json({
      error: 'Failed to get SSH configuration',
      code: 'SSH_CONFIG_ERROR'
    });
  }
});

/**
 * @route   PUT /api/v1/config/ssh
 * @desc    Update SSH configuration
 * @access  Private (Admin only)
 */
router.put('/ssh',
  [
    body('defaultPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('defaultPort must be between 1 and 65535'),
    body('connectionTimeout')
      .optional()
      .isInt({ min: 1000, max: 60000 })
      .withMessage('connectionTimeout must be between 1000 and 60000 milliseconds'),
    body('keepAliveInterval')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('keepAliveInterval must be between 1000 and 300000 milliseconds'),
    body('keepAliveCountMax')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('keepAliveCountMax must be between 1 and 10'),
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

      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Update SSH configuration
      Object.keys(req.body).forEach(key => {
        if (configuration.ssh.hasOwnProperty(key)) {
          configuration.ssh[key] = req.body[key];
        }
      });

      res.json({
        success: true,
        message: 'SSH configuration updated successfully',
        data: configuration.ssh
      });

    } catch (error) {
      console.error('Update SSH config error:', error);
      res.status(500).json({
        error: 'Failed to update SSH configuration',
        code: 'SSH_CONFIG_UPDATE_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/config/proxy
 * @desc    Get proxy configuration
 * @access  Private
 */
router.get('/proxy', (req, res) => {
  try {
    res.json({
      success: true,
      data: configuration.proxy
    });
  } catch (error) {
    console.error('Get proxy config error:', error);
    res.status(500).json({
      error: 'Failed to get proxy configuration',
      code: 'PROXY_CONFIG_ERROR'
    });
  }
});

/**
 * @route   PUT /api/v1/config/proxy
 * @desc    Update proxy configuration
 * @access  Private (Admin only)
 */
router.put('/proxy',
  [
    body('defaultPort')
      .optional()
      .isInt({ min: 1024, max: 65535 })
      .withMessage('defaultPort must be between 1024 and 65535'),
    body('enableAuth')
      .optional()
      .isBoolean()
      .withMessage('enableAuth must be a boolean'),
    body('enableLogging')
      .optional()
      .isBoolean()
      .withMessage('enableLogging must be a boolean'),
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

      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Update proxy configuration
      Object.keys(req.body).forEach(key => {
        if (configuration.proxy.hasOwnProperty(key)) {
          configuration.proxy[key] = req.body[key];
        }
      });

      res.json({
        success: true,
        message: 'Proxy configuration updated successfully',
        data: configuration.proxy
      });

    } catch (error) {
      console.error('Update proxy config error:', error);
      res.status(500).json({
        error: 'Failed to update proxy configuration',
        code: 'PROXY_CONFIG_UPDATE_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/config/reset
 * @desc    Reset configuration to defaults
 * @access  Private (Admin only)
 */
router.post('/reset', (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    // Reset to default configuration
    configuration = {
      global: {
        enableLogging: true,
        logLevel: 'info',
        maxConnections: 100,
        defaultReconnectDelay: 5000,
        enableMetrics: true
      },
      security: {
        enableRateLimit: true,
        maxRequestsPerMinute: 60,
        enableCors: true,
        allowedOrigins: ['*']
      },
      ssh: {
        defaultPort: 22,
        connectionTimeout: 10000,
        keepAliveInterval: 60000,
        keepAliveCountMax: 3
      },
      proxy: {
        defaultPort: 8080,
        enableAuth: false,
        enableLogging: true
      }
    };

    res.json({
      success: true,
      message: 'Configuration reset to defaults',
      data: configuration
    });

  } catch (error) {
    console.error('Reset configuration error:', error);
    res.status(500).json({
      error: 'Failed to reset configuration',
      code: 'CONFIG_RESET_ERROR'
    });
  }
});

/**
 * @route   POST /api/v1/config/export
 * @desc    Export configuration
 * @access  Private (Admin only)
 */
router.post('/export', (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    // Create export data (remove sensitive info)
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
      configuration: {
        global: configuration.global,
        security: {
          ...configuration.security,
          // Remove sensitive fields
        },
        ssh: configuration.ssh,
        proxy: configuration.proxy
      }
    };

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Export configuration error:', error);
    res.status(500).json({
      error: 'Failed to export configuration',
      code: 'CONFIG_EXPORT_ERROR'
    });
  }
});

/**
 * @route   POST /api/v1/config/import
 * @desc    Import configuration
 * @access  Private (Admin only)
 */
router.post('/import',
  [
    body('configuration')
      .isObject()
      .withMessage('Configuration object is required'),
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

      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      const { configuration: newConfig } = req.body;

      // Validate and merge configuration
      if (newConfig.global) {
        Object.keys(newConfig.global).forEach(key => {
          if (configuration.global.hasOwnProperty(key)) {
            configuration.global[key] = newConfig.global[key];
          }
        });
      }

      if (newConfig.ssh) {
        Object.keys(newConfig.ssh).forEach(key => {
          if (configuration.ssh.hasOwnProperty(key)) {
            configuration.ssh[key] = newConfig.ssh[key];
          }
        });
      }

      if (newConfig.proxy) {
        Object.keys(newConfig.proxy).forEach(key => {
          if (configuration.proxy.hasOwnProperty(key)) {
            configuration.proxy[key] = newConfig.proxy[key];
          }
        });
      }

      res.json({
        success: true,
        message: 'Configuration imported successfully',
        data: configuration
      });

    } catch (error) {
      console.error('Import configuration error:', error);
      res.status(500).json({
        error: 'Failed to import configuration',
        code: 'CONFIG_IMPORT_ERROR'
      });
    }
  }
);

module.exports = router;