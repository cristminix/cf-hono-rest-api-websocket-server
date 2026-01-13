# Environment Requirements and Dependencies

## System Requirements

### Operating System Support

- **Linux**: Ubuntu 18.04+, Debian 10+, CentOS 7+
- **macOS**: macOS 10.14+ (Mojave or later)
- **Windows**: Windows 10+ with WSL2 recommended, Windows 11 supported
- **Container Environments**: Docker, Kubernetes, Podman

### Hardware Requirements

- **CPU**: Modern processor with 2+ cores recommended
- **RAM**: Minimum 4GB, 8GB+ recommended for development
- **Storage**: 2GB free space for installation and dependencies
- **Network**: Stable internet connection for deployment and updates

## Software Prerequisites

### Node.js Environment

- **Node.js Version**: v18.0.0 or higher (v20.x LTS recommended)
- **npm Version**: v8.0.0 or higher (included with Node.js)
- **Alternative Package Manager**: Yarn v1.22+ or pnpm v7+

#### Node.js Installation Methods

```bash
# Using official installer
curl -fsSL https://nodejs.org/dist/latest-v20.x/node-v20.x.x-linux-x64.tar.xz | tar -xJ -C /opt/

# Using package managers
sudo apt install nodejs npm  # Ubuntu/Debian
brew install node            # macOS
choco install nodejs         # Windows with Chocolatey

# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
```

### Cloudflare Wrangler CLI

- **Wrangler Version**: v3.0.0 or higher
- **Installation Method**: npm global installation

#### Installation Commands

```bash
# Install globally via npm
npm install -g wrangler

# Verify installation
wrangler --version

# Login to Cloudflare account
wrangler login
```

## Project Dependencies

### Runtime Dependencies

#### Core Framework Dependencies

- **hono**: `^4.11.4`

  - Lightweight web framework for Cloudflare Workers
  - Provides routing, middleware, and request/response handling
  - License: MIT
  - Size: ~150KB

- **@hono/node-server**: `^1.19.8`

  - Node.js server adapter for Hono framework
  - Enables local development and testing
  - License: MIT
  - Required for local development only

- **ws**: `^8.19.0`
  - WebSocket client and server implementation
  - Used for WebSocket functionality in local development
  - License: MIT
  - Size: ~100KB

#### Dependency Tree

```
cf-worker-02
├── hono@4.11.4
├── @hono/node-server@1.19.8
│   └── hono@4.11.4
└── ws@8.19.0
```

### Development Dependencies

#### TypeScript Support

- **typescript**: `^5.9.3`

  - Static type checking for JavaScript
  - Language service for IDE integration
  - License: Apache-2.0
  - Size: ~100MB

- **@cloudflare/workers-types**: `^4.20260113.0`
  - TypeScript definitions for Cloudflare Workers APIs
  - Includes types for Web APIs, Workers-specific globals
  - License: BSD-3-Clause
  - Size: ~50MB

#### Node.js Type Definitions

- **@types/node**: `^25.0.7`
  - TypeScript definitions for Node.js built-in modules
  - Required for type checking in development environment
  - License: MIT
  - Size: ~2MB

### Dev Dependency Tree

```
devDependencies
├── typescript@5.9.3
├── @cloudflare/workers-types@4.20260113.0
│   └── typescript@5.9.3
└── @types/node@25.0.7
```

## Package Management

### npm Configuration

```json
{
  "name": "cf-worker-02",
  "version": "1.0.0",
  "description": "",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}
```

### Lock File Management

- **package-lock.json**: Generated automatically by npm
- **Integrity Checking**: SHA512 integrity hashes for all packages
- **Dependency Resolution**: Deterministic dependency trees

## Development Environment Setup

### IDE Recommendations

- **Visual Studio Code**: Recommended with extensions

  - `esbenp.prettier-vscode`: Code formatting
  - `bradlc.vscode-tailwindcss`: Tailwind CSS support
  - `ms-vscode.vscode-typescript-next`: TypeScript support

- **WebStorm**: Full TypeScript and Node.js support
- **Sublime Text**: With TypeScript plugin
- **Vim/Neovim**: With TypeScript language server

### Development Tools

- **TypeScript Compiler**: `tsc` for compilation
- **ESLint**: Code linting and quality checking
- **Prettier**: Code formatting
- **Git**: Version control system

## Local Development Environment

### Required Tools

```bash
# Node.js and npm (minimum versions)
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 8.0.0

# Wrangler CLI
wrangler --version  # Should be >= 3.0.0

# Git for version control
git --version
```

### Environment Variables

No specific environment variables required for basic operation, but the following may be useful:

```bash
# Cloudflare API token (if not using wrangler login)
export CLOUDFLARE_API_TOKEN="your-api-token"

# Custom port for local development
export PORT=8787
```

## Production Environment Requirements

### Cloudflare Workers Runtime

- **Runtime**: V8 JavaScript engine
- **Memory Limit**: 128MB standard, 512MB unbound
- **Execution Time**: 10ms standard, 30s unbound
- **Supported APIs**: Web APIs, Workers-specific globals

### Supported JavaScript Features

- **ECMAScript 2022**: Full support
- **Top-Level Await**: Supported
- **Web APIs**: Fetch, WebSocket, Crypto, TextEncoder/Decoder
- **Workers-Specific APIs**: KV, Durable Objects, R2, Queues

## Build Environment

### Compilation Requirements

- **TypeScript**: Version 5.0.0+ for compilation
- **Target**: ES2022 or ESNext
- **Module**: CommonJS or ESNext
- **Source Maps**: Enabled for debugging

### Build Scripts

```bash
# Compile TypeScript
npm run build
# or
npx tsc

# Development server
npm run dev
# or
npx wrangler dev

# Production deployment
npm run deploy
# or
npx wrangler deploy
```

## Network and Security Requirements

### Outbound Connections

- **HTTPS**: Required for secure communication
- **WebSocket**: ws:// and wss:// protocols
- **Port Range**: Typically 80, 443, 8787 (local dev)

### Firewall Configuration

- **Outbound HTTPS**: Port 443 to api.cloudflare.com
- **WebSocket Connections**: Port 443 for wss://
- **Local Development**: Port 8787 for wrangler dev

## Container Deployment Requirements

### Docker Configuration

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8787
CMD ["npx", "wrangler", "dev"]
```

### Kubernetes Requirements

- **Resource Limits**: CPU and memory constraints
- **Service Discovery**: Internal service communication
- **Secrets Management**: Secure storage for tokens

## Version Compatibility Matrix

| Component  | Minimum Version | Recommended Version | Notes                    |
| ---------- | --------------- | ------------------- | ------------------------ |
| Node.js    | 18.0.0          | 20.x LTS            | Required for ESM support |
| npm        | 8.0.0           | Latest stable       | Dependency resolution    |
| Wrangler   | 3.0.0           | Latest stable       | Cloudflare deployment    |
| TypeScript | 5.0.0           | 5.9.x               | Type checking            |
| hono       | 4.10.0          | 4.11.x              | Framework features       |

## Troubleshooting Environment Issues

### Common Problems

1. **Node.js Version Mismatch**: Use nvm to manage versions
2. **Permission Errors**: Run with appropriate user permissions
3. **Network Connectivity**: Verify internet access to npm registry
4. **Disk Space**: Ensure sufficient storage for dependencies

### Verification Commands

```bash
# Check all requirements
node --version && npm --version && wrangler --version

# Verify dependencies
npm ls --depth=0

# Check TypeScript compilation
npx tsc --noEmit
```

## Updating Dependencies

### Regular Maintenance

```bash
# Update all dependencies
npm update

# Check for outdated packages
npm outdated

# Audit security vulnerabilities
npm audit

# Update specific packages
npm update hono @hono/node-server ws
```

### Major Version Updates

- Always test major version updates in development first
- Check release notes for breaking changes
- Update TypeScript types accordingly
- Verify WebSocket functionality after updates
