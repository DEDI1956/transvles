# ZiVPN Manager - Advanced VPN Control Center

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)](package.json)

**ZiVPN Manager** adalah solusi manajemen VPN modern yang menyediakan antarmuka web untuk mengelola SSH tunneling, HTTP proxy, dan koneksi VPN dengan fitur monitoring real-time, auto-reconnection, dan kontrol yang mudah.

## ✨ Fitur Utama

### 🔗 SSH Tunneling
- **SSH Tunnel Management**: Buat dan kelola multiple SSH tunnel dengan mudah
- **Auto-reconnection**: Otomatis reconnect ketika koneksi terputus
- **Port Forwarding**: Dynamic dan local port forwarding
- **SSH Key Authentication**: Support untuk password dan private key authentication

### 🌐 HTTP Proxy
- **HTTP/HTTPS Proxy**: Buat HTTP proxy server dengan authentication
- **Connection Management**: Monitor dan kelola koneksi proxy
- **Logging**: Log request dan response untuk debugging

### 📊 Monitoring Real-time
- **WebSocket Updates**: Update status real-time melalui WebSocket
- **Connection Statistics**: Monitor traffic dan performa koneksi
- **System Monitoring**: Pantau penggunaan memory, CPU, dan uptime
- **Log Management**: Sistem logging yang komprehensif

### 🛡️ Keamanan
- **JWT Authentication**: Sistem autentikasi yang aman dengan JWT tokens
- **Role-based Access**: Control akses berdasarkan role (admin/user)
- **Rate Limiting**: Proteksi dari brute force attacks
- **Input Validation**: Validasi input yang komprehensif

### ⚙️ Konfigurasi Fleksibel
- **Web-based Config**: Konfigurasi melalui interface web
- **Export/Import**: Backup dan restore konfigurasi
- **Environment Variables**: Support untuk berbagai environment
- **Hot Reload**: Konfigurasi dapat diupdate tanpa restart

### 📱 Responsive Design
- **Modern UI**: Interface yang clean dan modern
- **Mobile Friendly**: Responsive untuk semua device
- **Dark/Light Theme**: Support untuk dark mode
- **Toast Notifications**: Feedback real-time untuk user actions

## 🚀 Deployment

### Platform yang Didukung

#### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy ke Vercel
vercel --prod

# Atau gunakan deployment script
npm run deploy:vercel
```

#### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login ke Railway
railway login

# Deploy
railway up

# Atau gunakan deployment script
npm run deploy:railway
```

#### Platform Lainnya
- **Heroku**: Gunakan `Procfile` yang disediakan
- **DigitalOcean**: Support App Platform
- **AWS**: Support Lambda dan ECS
- **Google Cloud**: Support Cloud Run
- **Azure**: Support App Service

## 📋 Prerequisites

- **Node.js**: Version 18 atau lebih tinggi
- **npm**: Version 8 atau lebih tinggi
- **SSH Access**: Untuk fitur SSH tunneling (optional)
- **SSL Certificate**: Untuk production deployment (recommended)

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-username/zivpn-manager.git
cd zivpn-manager
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 4. Build Application
```bash
# Build untuk production
npm run build

# Atau development mode
npm run dev
```

### 5. Start Application
```bash
# Production mode
npm start

# Development mode dengan hot reload
npm run dev
```

## ⚙️ Configuration

### Environment Variables

#### Required
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
```

#### Optional
```env
# API Configuration
API_PREFIX=/api/v1

# CORS Settings
ALLOWED_ORIGINS=https://yourdomain.com

# SSH Configuration
SSH_HOST=your-ssh-server.com
SSH_USER=your-username
SSH_PASSWORD=your-password

# VPN Settings
VPN_MAX_CONNECTIONS=100
VPN_DEFAULT_RECONNECT_DELAY=5000

# Logging
LOG_LEVEL=info
LOG_ENABLE_FILE_LOGGING=true
```

### SSH Tunnel Configuration

#### Menggunakan Password
```json
{
  "host": "your-ssh-server.com",
  "port": 22,
  "username": "your-username",
  "password": "your-password",
  "localPort": 1080,
  "remoteHost": "localhost",
  "remotePort": 80,
  "autoReconnect": true
}
```

#### Menggunakan Private Key
```json
{
  "host": "your-ssh-server.com",
  "port": 22,
  "username": "your-username",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "localPort": 1080,
  "remoteHost": "localhost",
  "remotePort": 80,
  "autoReconnect": true
}
```

## 🎯 Usage

### 1. Akses Web Interface
Buka browser dan akses:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### 2. Login Default
```
Username: admin
Password: admin123
```

**⚠️ PENTING**: Ubah password default setelah pertama login!

### 3. Membuat SSH Tunnel
1. Pergi ke tab **Tunnels**
2. Klik **Create Tunnel**
3. Isi form dengan detail SSH server
4. Klik **Create Tunnel**
5. Klik **Start** untuk mengaktifkan tunnel

### 4. Membuat HTTP Proxy
1. Pergi ke tab **Proxies**
2. Klik **Create Proxy**
3. Set port dan opsi authentication
4. Klik **Create Proxy**

### 5. Monitoring
- **Dashboard**: Overview koneksi aktif dan statistik sistem
- **Logs**: Lihat log sistem untuk troubleshooting
- **Configuration**: Atur pengaturan aplikasi

## 🏗️ API Documentation

### Authentication Endpoints
```
POST /api/v1/auth/login          # Login user
POST /api/v1/auth/logout         # Logout user
POST /api/v1/auth/refresh        # Refresh token
GET  /api/v1/auth/me            # Get current user
POST /api/v1/auth/change-password # Change password
```

### VPN Management Endpoints
```
GET  /api/v1/vpn/status         # Get VPN status
GET  /api/v1/vpn/connections    # Get all connections
POST /api/v1/vpn/tunnels        # Create SSH tunnel
POST /api/v1/vpn/tunnels/:id/start  # Start tunnel
POST /api/v1/vpn/tunnels/:id/stop   # Stop tunnel
DELETE /api/v1/vpn/tunnels/:id      # Remove tunnel
POST /api/v1/vpn/proxies       # Create HTTP proxy
```

### Configuration Endpoints
```
GET  /api/v1/config             # Get configuration
PUT  /api/v1/config/global      # Update global config
GET  /api/v1/config/ssh         # Get SSH config
PUT  /api/v1/config/ssh         # Update SSH config
```

### Status Endpoints
```
GET  /api/v1/status/health     # Health check
GET  /api/v1/status/system     # System info
GET  /api/v1/status/metrics    # Application metrics
GET  /api/v1/status/logs       # Get logs
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Test Coverage
```bash
npm run test:coverage
open coverage/index.html
```

## 🛠️ Development

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure
```
zivpn-manager/
├── src/                      # Backend source code
│   ├── api/                  # API routes
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── vpn.js          # VPN management endpoints
│   │   ├── config.js       # Configuration endpoints
│   │   └── status.js       # Status endpoints
│   ├── services/            # Business logic
│   │   └── VPNService.js   # Core VPN service
│   ├── middleware/          # Express middleware
│   │   └── auth.js         # Authentication middleware
│   └── websocket/           # WebSocket handling
│       └── WebSocketManager.js
├── public/                   # Frontend assets
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript modules
│   ├── images/              # Images and icons
│   └── index.html          # Main HTML template
├── config/                  # Configuration files
├── logs/                   # Application logs
├── tests/                  # Test files
├── server.js              # Main application entry point
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── vercel.json           # Vercel deployment config
├── railway.json          # Railway deployment config
└── README.md             # This file
```

### Adding New Features
1. Create feature branch: `git checkout -b feature/new-feature`
2. Implement feature in appropriate module
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 🔧 Troubleshooting

### Common Issues

#### Connection Timeout
```bash
# Increase timeout in .env
VPN_CONNECTION_TIMEOUT=30000
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### SSH Authentication Failed
- Verify SSH credentials
- Check SSH server configuration
- Ensure firewall allows SSH connections

#### WebSocket Connection Failed
- Check if WebSocket is enabled
- Verify proxy/load balancer WebSocket support
- Check firewall settings

### Log Analysis
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# Search for specific errors
grep "ERROR" logs/combined.log
```

## 📊 Monitoring

### Health Checks
- **Endpoint**: `GET /health`
- **Response**: Application health status
- **Use**: Load balancer health checks

### Metrics
- **Endpoint**: `GET /api/v1/status/metrics`
- **Metrics**: Memory usage, CPU usage, connection stats
- **Integration**: Prometheus, Grafana

### Logging
- **Levels**: error, warn, info, debug
- **Output**: Console, files, external services
- **Format**: JSON structured logging

## 🔒 Security

### Best Practices
1. **Change Default Credentials**: Update admin password immediately
2. **Use HTTPS**: Always use SSL/TLS in production
3. **Environment Variables**: Never commit secrets to version control
4. **Regular Updates**: Keep dependencies updated
5. **Firewall**: Configure firewall rules properly

### Security Headers
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### Authentication
- JWT tokens with expiration
- Refresh token rotation
- Rate limiting on auth endpoints
- Secure session management

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit pull request

### Code Standards
- ESLint configuration provided
- Prettier for code formatting
- Conventional commits
- Test coverage > 80%

### Reporting Issues
- Use GitHub Issues
- Include reproduction steps
- Provide system information
- Attach logs if relevant

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Configuration Reference](docs/configuration.md)

### Community
- [GitHub Issues](https://github.com/your-username/zivpn-manager/issues)
- [Discussions](https://github.com/your-username/zivpn-manager/discussions)

### Professional Support
Contact us for enterprise support and custom development.

---

**ZiVPN Manager** - Making VPN management simple and powerful! 🚀