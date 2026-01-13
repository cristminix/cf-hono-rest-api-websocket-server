# API Documentation

## HTTP Endpoints

### GET /

**Description**: Basic health check and connection statistics  
**Method**: GET  
**Path**: `/`  
**Authentication**: None required

**Response**:

- **Status**: 200 OK
- **Content-Type**: text/plain
- **Body**: Plain text response containing current connection count and WebSocket endpoint information

**Example Response**:

```
Hello Hono with Enhanced WebSockets!
Current connections: 3
WebSocket endpoint: /websocket
```

### GET /health

**Description**: Detailed health status with connection statistics  
**Method**: GET  
**Path**: `/health`  
**Authentication**: None required

**Response**:

- **Status**: 200 OK
- **Content-Type**: application/json
- **Body**: JSON object with health status and connection information

**Response Schema**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "webSocketConnections": 0
}
```

**Example Response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "webSocketConnections": 5
}
```

### GET /ws-stats

**Description**: WebSocket connection statistics  
**Method**: GET  
**Path**: `/ws-stats`  
**Authentication**: None required

**Response**:

- **Status**: 200 OK
- **Content-Type**: application/json
- **Body**: JSON object with connection count and status

**Response Schema**:

```json
{
  "connectionCount": 0,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "active"
}
```

**Example Response**:

```json
{
  "connectionCount": 3,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "status": "active"
}
```

## WebSocket Endpoint

### GET /websocket

**Description**: WebSocket upgrade endpoint for real-time bidirectional communication  
**Method**: GET  
**Path**: `/websocket`  
**Protocol**: WebSocket (ws:// or wss://)  
**Authentication**: None required (connection-based)

**Upgrade Process**:

1. Client initiates WebSocket connection to `/websocket`
2. Server generates unique connection ID
3. Server sends welcome message
4. Connection is added to global connection manager

### WebSocket Message Types

#### Server → Client Messages

**Welcome Message**:

```json
{
  "type": "welcome",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "connectionCount": "number"
}
```

**User Joined Notification**:

```json
{
  "type": "user_joined",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "totalUsers": "number"
}
```

**User Left Notification**:

```json
{
  "type": "user_left",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "totalUsers": "number"
}
```

**Heartbeat Ping**:

```json
{
  "type": "ping",
  "timestamp": "number (Unix timestamp)"
}
```

**Pong Response**:

```json
{
  "type": "pong",
  "timestamp": "number (Unix timestamp)"
}
```

**Broadcast Message**:

```json
{
  "type": "broadcast",
  "connectionId": "string",
  "content": "string",
  "timestamp": "ISO 8601 datetime string"
}
```

**Message Response**:

```json
{
  "type": "message",
  "connectionId": "string",
  "content": "string",
  "timestamp": "ISO 8601 datetime string"
}
```

**User Info Response**:

```json
{
  "type": "user_info_response",
  "connectionId": "string",
  "connectionCount": "number",
  "timestamp": "ISO 8601 datetime string"
}
```

**Error Message**:

```json
{
  "type": "error",
  "message": "string"
}
```

#### Client → Server Messages

**Text Message**:

```json
{
  "type": "message",
  "content": "string (max 1000 characters)"
}
```

**Broadcast Message**:

```json
{
  "type": "broadcast",
  "content": "string (max 1000 characters)"
}
```

**Ping Message**:

```json
{
  "type": "ping"
}
```

**User Info Request**:

```json
{
  "type": "user_info"
}
```

**Plain Text Message** (non-JSON):

- Plain text string (will be treated as message type)

### WebSocket Events

#### Connection Events

**onOpen**: Triggered when WebSocket connection is established

- Server sends welcome message
- Connection is tracked in global manager
- Other users receive "user_joined" notification

**onClose**: Triggered when WebSocket connection is closed

- Connection is removed from global manager
- Other users receive "user_left" notification
- Connection statistics are updated

**onError**: Triggered when WebSocket error occurs

- Connection is removed from global manager
- Connection statistics are updated
- Error is logged for debugging

#### Message Processing

**Message Validation**:

- Maximum message length: 1000 characters
- Empty messages are rejected
- JSON parsing with fallback to plain text
- Type validation for known message types

**Message Routing**:

- `message` type: Sent to all other connected clients
- `broadcast` type: Sent to all connected clients (including sender)
- `ping` type: Responded with `pong` message
- `user_info` type: Responded with connection information
- Unknown types: Rejected with error message

### Error Handling

**Common Error Responses**:

```json
{
  "type": "error",
  "message": "Empty message not allowed"
}
```

```json
{
  "type": "error",
  "message": "Message too long (max 1000 characters)"
}
```

```json
{
  "type": "error",
  "message": "Unknown message type: invalid_type"
}
```

### Connection Management

**Heartbeat System**:

- Ping interval: 30 seconds
- Automatic connection cleanup
- Dead connection detection

**Connection Statistics**:

- Real-time connection count
- Individual connection tracking
- Global connection management

**Cleanup Process**:

- Periodic cleanup every 30 seconds
- Removal of closed connections
- Updated connection notifications
