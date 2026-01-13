# WebSocket Protocol Specification

## Overview

The Cloudflare Worker WebSocket server implements a bidirectional communication protocol that enables real-time messaging between clients and the server. The protocol is designed to be efficient, reliable, and scalable while maintaining compatibility with standard WebSocket implementations.

## Connection Establishment

### Handshake Process

1. **Client Initiation**: Client sends WebSocket upgrade request to `/websocket` endpoint
2. **Server Upgrade**: Server responds with successful upgrade to WebSocket protocol
3. **Connection ID Generation**: Server generates unique connection identifier
4. **Welcome Message**: Server sends welcome message with connection details
5. **Connection Tracking**: Connection is registered in global connection manager

### Connection ID Format

```
ws-{timestamp}-{random_string}
```

Example: `ws-1703123456789-abc123def45`

Where:

- `{timestamp}`: Unix timestamp in milliseconds
- `{random_string}`: 9-character random alphanumeric string

## Message Protocol

### Message Structure

All messages follow the JSON format with a mandatory `type` field:

```json
{
  "type": "message_type",
  "timestamp": "ISO 8601 datetime or Unix timestamp",
  "content": "message_content",
  "connectionId": "unique_connection_identifier"
}
```

### Message Types

#### Server-Sent Messages

**1. Welcome Message**

- **Type**: `welcome`
- **Direction**: Server → Client
- **Purpose**: Initial connection acknowledgment

```json
{
  "type": "welcome",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "connectionCount": "number"
}
```

**2. User Join Notification**

- **Type**: `user_joined`
- **Direction**: Server → Client
- **Purpose**: Notify of new connection

```json
{
  "type": "user_joined",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "totalUsers": "number"
}
```

**3. User Leave Notification**

- **Type**: `user_left`
- **Direction**: Server → Client
- **Purpose**: Notify of disconnection

```json
{
  "type": "user_left",
  "connectionId": "string",
  "timestamp": "ISO 8601 datetime string",
  "totalUsers": "number"
}
```

**4. Heartbeat Ping**

- **Type**: `ping`
- **Direction**: Server → Client
- **Purpose**: Connection health check
- **Frequency**: Every 30 seconds

```json
{
  "type": "ping",
  "timestamp": "number (Unix timestamp)"
}
```

**5. Heartbeat Pong**

- **Type**: `pong`
- **Direction**: Server → Client
- **Purpose**: Ping response (automatically generated)

```json
{
  "type": "pong",
  "timestamp": "number (Unix timestamp)"
}
```

**6. Broadcast Message**

- **Type**: `broadcast`
- **Direction**: Server → All Clients
- **Purpose**: System-wide message distribution

```json
{
  "type": "broadcast",
  "connectionId": "string",
  "content": "string",
  "timestamp": "ISO 8601 datetime string"
}
```

**7. Direct Message**

- **Type**: `message`
- **Direction**: Server → Other Clients
- **Purpose**: Peer-to-peer communication

```json
{
  "type": "message",
  "connectionId": "string",
  "content": "string",
  "timestamp": "ISO 8601 datetime string"
}
```

**8. User Info Response**

- **Type**: `user_info_response`
- **Direction**: Server → Requesting Client
- **Purpose**: Connection statistics response

```json
{
  "type": "user_info_response",
  "connectionId": "string",
  "connectionCount": "number",
  "timestamp": "ISO 8601 datetime string"
}
```

**9. Error Message**

- **Type**: `error`
- **Direction**: Server → Client
- **Purpose**: Error notification

```json
{
  "type": "error",
  "message": "string"
}
```

#### Client-Sent Messages

**1. Text Message**

- **Type**: `message`
- **Direction**: Client → Server → Other Clients
- **Purpose**: Regular chat message

```json
{
  "type": "message",
  "content": "string (max 1000 characters)"
}
```

**2. Broadcast Message**

- **Type**: `broadcast`
- **Direction**: Client → Server → All Clients
- **Purpose**: Message to all connected clients

```json
{
  "type": "broadcast",
  "content": "string (max 1000 characters)"
}
```

**3. Heartbeat Ping**

- **Type**: `ping`
- **Direction**: Client → Server
- **Purpose**: Connection health check (optional, server handles automatically)

```json
{
  "type": "ping"
}
```

**4. User Info Request**

- **Type**: `user_info`
- **Direction**: Client → Server
- **Purpose**: Request connection information

```json
{
  "type": "user_info"
}
```

**5. Plain Text Message**

- **Format**: Plain string
- **Direction**: Client → Server
- **Purpose**: Fallback for non-JSON messages

```
"Plain text message"
```

## Protocol Rules

### Message Validation

1. **Content Length**: Maximum 1000 characters per message
2. **Empty Messages**: Rejected with error response
3. **JSON Parsing**: Invalid JSON treated as plain text
4. **Unknown Types**: Rejected with error response

### Connection Management

1. **Unique IDs**: Each connection receives unique identifier
2. **Connection Tracking**: Active connections maintained in memory
3. **Automatic Cleanup**: Closed connections removed automatically
4. **Periodic Cleanup**: Every 30 seconds, closed connections purged

### Heartbeat Mechanism

1. **Ping Interval**: 30-second intervals
2. **Connection Health**: Detects dead connections
3. **Automatic Response**: Pong responses handled internally
4. **Timeout Detection**: Unresponsive connections closed

### Broadcasting Rules

1. **Message Distribution**: All active connections receive messages
2. **Exclusion Logic**: Sender excluded from direct messages
3. **Inclusion Logic**: Sender included in broadcasts
4. **Error Handling**: Failed sends logged but don't interrupt others

## State Management

### Connection States

1. **CONNECTING**: WebSocket handshake in progress
2. **OPEN**: Active connection ready for communication
3. **CLOSING**: Connection termination in progress
4. **CLOSED**: Connection terminated

### Message Flow States

1. **INCOMING**: Message received, validation pending
2. **VALIDATED**: Message validated, routing pending
3. **ROUTED**: Message distributed to recipients
   4 **FAILED**: Message processing failed

## Error Handling

### Common Error Scenarios

1. **Invalid JSON**: Malformed JSON messages
2. **Message Too Long**: Exceeds 1000 character limit
3. **Unknown Message Type**: Unsupported message types
4. **Connection Lost**: Network interruption
5. **Server Error**: Internal server processing errors

### Error Response Format

```json
{
  "type": "error",
  "message": "descriptive_error_message"
}
```

## Performance Considerations

### Memory Management

- **Connection Storage**: O(n) memory usage where n is active connections
- **Message Buffering**: Temporary storage for outgoing messages
- **Cleanup Frequency**: 30-second intervals to remove stale references

### Network Efficiency

- **Message Compression**: JSON payload optimization
- **Batch Operations**: Multiple messages may be batched
- **Connection Pooling**: Efficient resource utilization

### Scalability Limits

- **Connection Limits**: Subject to Cloudflare Workers resource limits
- **Message Throughput**: Dependent on network conditions
- **Memory Usage**: Each connection consumes server memory

## Security Considerations

### Input Validation

- **Content Filtering**: Message content validation
- **Length Limiting**: Prevent buffer overflow attacks
- **Type Checking**: Ensure message type validity

### Connection Security

- **Origin Validation**: WebSocket origin verification
- **Rate Limiting**: Connection and message rate controls
- **Access Control**: No authentication required (connection-based)

## Implementation Details

### Server Architecture

- **Single Instance**: One WebSocketManager per worker instance
- **Global State**: Shared connection state across requests
- **Event Loop**: Non-blocking message processing
- **Memory Isolation**: Each worker instance maintains separate state

### Client Compatibility

- **Standard WebSocket**: Compatible with all WebSocket implementations
- **Browser Support**: Works with modern browsers
- **Mobile Support**: Compatible with mobile WebSocket clients
- **Framework Agnostic**: Independent of client-side frameworks

This protocol ensures reliable, scalable, and efficient real-time communication while maintaining compatibility with standard WebSocket implementations and Cloudflare Workers constraints.
