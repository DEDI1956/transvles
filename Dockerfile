# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs config temp keys

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zivpn -u 1001

# Change ownership of app directory
RUN chown -R zivpn:nodejs /app

# Switch to non-root user
USER zivpn

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["npm", "start"]