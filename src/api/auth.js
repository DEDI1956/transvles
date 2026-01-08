const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Login rate limiting (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 login requests per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory user storage (in production, use a proper database)
const users = new Map();

// Initialize default admin user
const initializeDefaultUser = () => {
  const defaultAdmin = {
    id: 'admin',
    username: 'admin',
    email: 'admin@zivpn.local',
    password: bcrypt.hashSync('admin123', 10), // Change this in production!
    role: 'admin',
    createdAt: new Date(),
    lastLogin: null,
    isActive: true,
    permissions: ['read', 'write', 'admin']
  };
  
  users.set('admin', defaultAdmin);
  console.log('Default admin user created: admin/admin123');
};

initializeDefaultUser();

// Middleware to verify JWT token
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

// Middleware to check admin permissions
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', 
  loginLimiter,
  [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const { username, password, rememberMe } = req.body;

      // Find user
      const user = users.get(username);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          error: 'Account is disabled',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login
      user.lastLogin = new Date();

      // Generate JWT token
      const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        rememberMe: !!rememberMe
      };

      const expiresIn = rememberMe ? '30d' : '24h';
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'zivpn-secret',
        { expiresIn }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'zivpn-refresh-secret',
        { expiresIn: '30d' }
      );

      // Set session cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permissions: user.permissions,
            lastLogin: user.lastLogin
          },
          expiresIn
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    User logout
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // Clear session cookie
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token required',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      // Verify refresh token
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'zivpn-refresh-secret', (err, decoded) => {
        if (err) {
          return res.status(403).json({
            error: 'Invalid refresh token',
            code: 'REFRESH_TOKEN_INVALID'
          });
        }

        if (decoded.type !== 'refresh') {
          return res.status(403).json({
            error: 'Invalid token type',
            code: 'INVALID_TOKEN_TYPE'
          });
        }

        // Find user
        const user = users.get(decoded.id);
        if (!user || !user.isActive) {
          return res.status(401).json({
            error: 'User not found or inactive',
            code: 'USER_INACTIVE'
          });
        }

        // Generate new access token
        const newToken = jwt.sign(
          {
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
          },
          process.env.JWT_SECRET || 'zivpn-secret',
          { expiresIn: '24h' }
        );

        // Generate new refresh token
        const newRefreshToken = jwt.sign(
          { id: user.id, type: 'refresh' },
          process.env.JWT_REFRESH_SECRET || 'zivpn-refresh-secret',
          { expiresIn: '30d' }
        );

        res.json({
          success: true,
          data: {
            token: newToken,
            refreshToken: newRefreshToken,
            expiresIn: '24h'
          }
        });
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'REFRESH_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_INFO_ERROR'
    });
  }
});

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
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

      const { currentPassword, newPassword } = req.body;
      const user = users.get(req.user.id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      user.password = hashedNewPassword;
      user.updatedAt = new Date();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
);

/**
 * @route   POST /api/v1/auth/create-user
 * @desc    Create new user (admin only)
 * @access  Private (Admin)
 */
router.post('/create-user',
  authenticateToken,
  requireAdmin,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin'),
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

      const { username, email, password, role = 'user' } = req.body;

      // Check if user already exists
      if (users.has(username)) {
        return res.status(409).json({
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        });
      }

      // Check if email already exists
      for (const user of users.values()) {
        if (user.email === email) {
          return res.status(409).json({
            error: 'Email already exists',
            code: 'EMAIL_EXISTS'
          });
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const newUser = {
        id: username,
        username,
        email,
        password: hashedPassword,
        role,
        createdAt: new Date(),
        lastLogin: null,
        isActive: true,
        permissions: role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write']
      };

      users.set(username, newUser);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          permissions: newUser.permissions
        }
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'USER_CREATION_ERROR'
      });
    }
  }
);

/**
 * @route   GET /api/v1/auth/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userList = Array.from(users.values()).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isActive: user.isActive
    }));

    res.json({
      success: true,
      data: {
        users: userList,
        total: userList.length
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'GET_USERS_ERROR'
    });
  }
});

module.exports = router;