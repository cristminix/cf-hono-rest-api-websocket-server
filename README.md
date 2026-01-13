# Cloudflare Worker WebSocket Server

A high-performance WebSocket server built with Cloudflare Workers and Hono framework. This server provides real-time bidirectional communication with advanced features including connection management, heartbeating, broadcasting, and automatic cleanup of closed connections.

## Project Structure

```
cf-worker-02/
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── wrangler.toml         # Cloudflare Workers configuration
├── src/
│   └── index.ts          # Main application entry point
└── README.md            # This documentation file
```

## Features

- **Real-time WebSocket Communication**: Full-duplex communication channels
- **Connection Management**: Automatic connection tracking and cleanup
- **Heartbeat Mechanism**: 30-second ping-pong to detect dead connections
- **Broadcast Messaging**: Send messages to all connected clients
- **Message Validation**: Content length and format validation
- **Health Monitoring**: Connection statistics and health checks
- **Automatic Cleanup**: Periodic removal of closed connections

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Cloudflare account for deployment
- Wrangler CLI tool installed globally

## Installation

1. Clone or download the project
2. Install dependencies:

```bash
npm install
```

3. Install Wrangler CLI (if not already installed):

```bash
npm install -g wrangler
```

## Development Setup

### Local Development

Start the local development server with hot reloading:

```bash
npm run dev
```

This will start the worker on `http://localhost:8787` by default.

### Build for Production

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Deploy to Cloudflare

Deploy the worker to your Cloudflare account:

```bash
npm run deploy
```

Make sure you have configured your `account_id` in `wrangler.toml` before deploying.

## Configuration

### Environment Variables

The worker can be configured through environment variables in `wrangler.toml`:

```toml
[env.production]
account_id = "your-account-id"
route = "your-domain.com/*"

# Optional environment variables
[[env.production.vars]]
API_KEY = "your-api-key"
```

### Wrangler Configuration

The `wrangler.toml` file contains essential configuration:

- `name`: Worker name on Cloudflare
- `main`: Entry point file
- `compatibility_date`: Ensures consistent API behavior
- `account_id`: Your Cloudflare account identifier
- `route`: Domain routing configuration

## Endpoints

### HTTP Routes

- `GET /` - Basic health check and connection statistics
- `GET /health` - Detailed health status with connection count
- `GET /ws-stats` - WebSocket connection statistics
- `GET /websocket` - WebSocket upgrade endpoint

### WebSocket Endpoint

- `/websocket` - Upgraded WebSocket connection endpoint

## Dependencies

### Runtime Dependencies

- `hono`: Fast, lightweight web framework
- `@hono/node-server`: Node.js server adapter for Hono
- `ws`: WebSocket library (for local development)

### Development Dependencies

- `@cloudflare/workers-types`: TypeScript definitions for Cloudflare Workers
- `@types/node`: TypeScript definitions for Node.js
- `typescript`: TypeScript compiler
- `wrangler`: Cloudflare Workers CLI tool

## WebSocket Protocol Specification

### Connection Process

1. Client connects to `/websocket` endpoint
2. Server generates unique connection ID
3. Server sends welcome message with connection details
4. Connection is added to global connection manager

### Message Formats

#### Welcome Message (Server → Client)

```json
{
  "type": "welcome",
  "connectionId": "ws-123456789-abc123def",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "connectionCount": 5
}
```

#### Text Message (Client ↔ Client)

```json
{
  "type": "message",
  "content": "Hello World!",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Broadcast Message (Client → Server → All Clients)

```json
{
  "type": "broadcast",
  "content": "System announcement",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Heartbeat Messages

- **Ping** (Server → Client):

```json
{
  "type": "ping",
  "timestamp": 1234567890123
}
```

- **Pong** (Client → Server):

```json
{
  "type": "pong",
  "timestamp": 1234567890123
}
```

#### User Join/Leave Notifications

```json
{
  "type": "user_joined",
  "connectionId": "ws-123456789-abc123def",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "totalUsers": 6
}
```

#### Error Messages

```json
{
  "type": "error",
  "message": "Error description"
}
```

### Message Types

- `message`: Regular text messages between clients
- `broadcast`: Messages sent to all connected clients
- `ping/pong`: Heartbeat mechanism for connection health
- `user_joined`: Notification when a user joins
- `user_left`: Notification when a user leaves
- `welcome`: Initial connection welcome message
- `error`: Error notifications

## Testing Instructions

### Local Testing

1. Start the development server:

```bash
npm run dev
```

2. Use a WebSocket testing tool or browser console to connect:

```javascript
const ws = new WebSocket("ws://localhost:8787/websocket")

ws.onopen = () => console.log("Connected")
ws.onmessage = (event) => console.log("Received:", event.data)
ws.onclose = () => console.log("Disconnected")
ws.onerror = (error) => console.error("Error:", error)

// Send a message
ws.send(JSON.stringify({ type: "message", content: "Hello!" }))
```

### Production Testing

Connect to your deployed worker endpoint:

```javascript
const ws = new WebSocket(
  "wss://your-worker.your-subdomain.workers.dev/websocket"
)
```

### Health Check

Verify the service is running by visiting:

- `https://your-worker.your-subdomain.workers.dev/health`
- `https://your-worker.your-subdomain.workers.dev/ws-stats`

## Deployment

### Prerequisites

1. Cloudflare account with Workers enabled
2. Account ID from Cloudflare dashboard
3. Wrangler CLI authenticated:

```bash
wrangler login
```

### Configuration

Update `wrangler.toml` with your settings:

```toml
[env.production]
account_id = "your-cloudflare-account-id"
route = "your-domain.com/*"  # Optional: for custom domain
workers_dev = true  # Set to false for production routes
```

### Deploy Commands

Deploy to Cloudflare:

```bash
npm run deploy
```

Or directly with Wrangler:

```bash
wrangler deploy
```

### Environment-specific Deployment

Deploy to specific environment:

```bash
wrangler deploy --env production
```

## Performance Considerations

- **Connection Limits**: Cloudflare Workers have memory and CPU limits
- **Message Size**: Messages are limited to prevent abuse (1000 characters max)
- **Heartbeat Frequency**: 30-second intervals to balance reliability and resource usage
- **Cleanup Interval**: 30-second periodic cleanup of closed connections

## Security Features

- **Message Validation**: Content length and format validation
- **Connection Tracking**: Unique IDs for each connection
- **Rate Limiting**: Heartbeat mechanism prevents zombie connections
- **Input Sanitization**: JSON parsing with error handling

## Troubleshooting

See the troubleshooting section in the full documentation for common issues and solutions.
