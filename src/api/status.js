const express = require('express');
const os = require('os');

const router = express.Router();

/**
 * @route   GET /api/v1/status/health
 * @desc    Basic health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.json({
    success: true,
    data: health
  });
});

/**
 * @route   GET /api/v1/status/system
 * @desc    Get system information
 * @access  Private
 */
router.get('/system', (req, res) => {
  try {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      networkInterfaces: Object.keys(os.networkInterfaces()),
      hostname: os.hostname(),
      nodeVersion: process.version,
      uptime: os.uptime()
    };

    res.json({
      success: true,
      data: systemInfo
    });

  } catch (error) {
    console.error('Get system status error:', error);
    res.status(500).json({
      error: 'Failed to get system information',
      code: 'SYSTEM_STATUS_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/status/metrics
 * @desc    Get application metrics
 * @access  Private
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoopDelay: process.hrtime.bigint(),
      version: process.version,
      pid: process.pid,
      // Additional metrics can be added here
      connections: req.app.locals.vpnService ? 
        req.app.locals.vpnService.getStatus().stats : null
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      code: 'METRICS_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/status/logs
 * @desc    Get recent logs
 * @access  Private
 */
router.get('/logs', (req, res) => {
  try {
    const { level, limit = 100, since } = req.query;
    
    // In a real implementation, you would fetch logs from a proper logging system
    // For now, we'll return mock log data
    const mockLogs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'ZiVPN Manager started successfully',
        source: 'system'
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'info',
        message: 'VPN service initialized',
        source: 'vpn-service'
      },
      {
        timestamp: new Date(Date.now() - 120000).toISOString(),
        level: 'info',
        message: 'WebSocket server started',
        source: 'websocket'
      }
    ];

    // Filter by level if specified
    let filteredLogs = mockLogs;
    if (level) {
      filteredLogs = mockLogs.filter(log => log.level === level);
    }

    // Apply limit
    filteredLogs = filteredLogs.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        logs: filteredLogs,
        total: filteredLogs.length,
        level: level || 'all',
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      error: 'Failed to get logs',
      code: 'LOGS_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/status/summary
 * @desc    Get comprehensive status summary
 * @access  Private
 */
router.get('/summary', (req, res) => {
  try {
    const vpnService = req.app.locals.vpnService;
    const vpnStatus = vpnService ? vpnService.getStatus() : { stats: {}, activeConnections: [] };

    const summary = {
      timestamp: new Date().toISOString(),
      application: {
        status: 'running',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()
      },
      memory: process.memoryUsage(),
      vpn: {
        status: vpnStatus.stats ? 'active' : 'inactive',
        activeConnections: vpnStatus.activeConnections?.length || 0,
        totalConnections: vpnStatus.stats?.totalConnections || 0,
        uptime: vpnStatus.stats?.uptime || null
      },
      network: {
        interfaces: Object.keys(os.networkInterfaces()),
        hostname: os.hostname()
      }
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get status summary error:', error);
    res.status(500).json({
      error: 'Failed to get status summary',
      code: 'STATUS_SUMMARY_ERROR'
    });
  }
});

/**
 * @route   POST /api/v1/status/restart
 * @desc    Restart application services
 * @access  Private (Admin only)
 */
router.post('/restart', (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    // In a real implementation, this would restart specific services
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Service restart initiated',
      data: {
        restartTime: new Date().toISOString(),
        affectedServices: ['vpn-service', 'websocket', 'api']
      }
    });

  } catch (error) {
    console.error('Restart service error:', error);
    res.status(500).json({
      error: 'Failed to restart services',
      code: 'RESTART_ERROR'
    });
  }
});

/**
 * @route   GET /api/v1/status/version
 * @desc    Get application version info
 * @access  Public
 */
router.get('/version', (req, res) => {
  const versionInfo = {
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    gitCommit: process.env.GIT_COMMIT || 'unknown'
  };

  res.json({
    success: true,
    data: versionInfo
  });
});

module.exports = router;