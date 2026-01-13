# Error Handling and Troubleshooting Guide

## Common Errors and Solutions

### 1. Connection Issues

#### Error: "WebSocket connection to 'wss://...' failed"

**Symptoms**: Unable to establish WebSocket connection
**Possible Causes**:

- Incorrect URL or domain
- SSL/TLS certificate issues
- Network connectivity problems
- Firewall blocking WebSocket connections

**Solutions**:

```bash
# Verify the endpoint is accessible
curl -I https://your-worker.your-subdomain.workers.dev/

# Check if the WebSocket endpoint is responding
# Use browser developer tools to inspect network requests
```

**Prevention**:

- Verify your Cloudflare Workers domain is correct
- Ensure the `/websocket` endpoint is properly deployed
- Test with both `ws://` (local) and `wss://` (production)

#### Error: "Connection closed before established"

**Symptoms**: Connection closes immediately after opening
**Possible Causes**:

- Server-side connection limits
- Invalid handshake response
- Cloudflare rate limiting

**Solutions**:

```javascript
// Add retry logic with exponential backoff
function connectWithRetry(url, retries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)

    ws.onopen = () => resolve(ws)
    ws.onerror = (error) => {
      if (retries > 0) {
        setTimeout(() => {
          connectWithRetry(url, retries - 1, delay * 2)
            .then(resolve)
            .catch(reject)
        }, delay)
      } else {
        reject(error)
      }
    }
  })
}
```

### 2. Message Handling Errors

#### Error: "Invalid message format" or "Unknown message type"

**Symptoms**: Receiving error messages from server
**Possible Causes**:

- Malformed JSON messages
- Unsupported message types
- Empty or null message content

**Solutions**:

```javascript
// Proper message validation before sending
function sendMessage(ws, content) {
  const message = {
    type: "message",
    content: content.trim(),
  }

  // Validate message before sending
  if (!message.content || message.content.length === 0) {
    console.error("Cannot send empty message")
    return false
  }

  if (message.content.length > 1000) {
    console.error("Message too long (max 1000 characters)")
    return false
  }

  try {
    ws.send(JSON.stringify(message))
    return true
  } catch (error) {
    console.error("Failed to send message:", error)
    return false
  }
}
```

#### Error: "Message too long (max 1000 characters)"

**Symptoms**: Messages rejected by server
**Solutions**:

```javascript
// Client-side message length validation
function truncateMessage(content, maxLength = 1000) {
  if (content.length <= maxLength) {
    return content
  }

  // Truncate and add indicator
  return content.substring(0, maxLength - 3) + "..."
}

// Before sending any message
const safeContent = truncateMessage(userInput)
sendMessage(ws, safeContent)
```

### 3. Heartbeat and Connection Health Issues

#### Error: "Connection timed out" or "Connection lost"

**Symptoms**: Connection drops unexpectedly
**Possible Causes**:

- Idle connection timeout (Cloudflare 10-minute limit)
- Network instability
- Server-side heartbeat failure

**Solutions**:

```javascript
// Implement client-side heartbeat
class WebSocketWithHeartbeat {
  constructor(url) {
    this.url = url
    this.ws = null
    this.heartbeatInterval = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5

    this.connect()
  }

  connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log("WebSocket connected")
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason)
      this.stopHeartbeat()
      this.attemptReconnect()
    }

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    this.ws.onmessage = (event) => {
      // Reset reconnect attempts on any message
      this.reconnectAttempts = 0

      // Handle heartbeat responses
      try {
        const message = JSON.parse(event.data)
        if (message.type === "ping") {
          // Server sends ping, we don't need to respond manually
          console.log("Received ping from server")
        }
      } catch (e) {
        // Non-JSON message, ignore heartbeat logic
      }
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        // Send a simple message to keep connection alive
        this.ws.send(JSON.stringify({ type: "ping" }))
      }
    }, 25000) // Send heartbeat every 25 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

      console.log(
        `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
      )

      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      console.error("Max reconnection attempts reached")
    }
  }
}
```

### 4. Server-Side Error Handling

#### Error: "Failed to send message to connection"

**Symptoms**: Server logs show message delivery failures
**Causes**: Connection closed while trying to send message
**Solutions**: The server already handles this gracefully, but monitor logs for patterns.

#### Error: "Connection cleanup failed"

**Symptoms**: Memory leaks or zombie connections
**Solutions**: The server has automatic cleanup every 30 seconds, but monitor connection counts.

## Debugging Techniques

### 1. Client-Side Debugging

#### Enable Verbose Logging

```javascript
// Add comprehensive logging
const ws = new WebSocket(
  "wss://your-worker.your-subdomain.workers.dev/websocket"
)

ws.onopen = function (event) {
  console.log("✅ WebSocket connected:", event)
}

ws.onmessage = function (event) {
  console.log("📥 Received message:", event.data)
  try {
    const message = JSON.parse(event.data)
    console.log("Parsed message:", message)
  } catch (e) {
    console.log("Raw message (not JSON):", event.data)
  }
}

ws.onclose = function (event) {
  console.log("❌ WebSocket closed:", event.code, event.reason)
}

ws.onerror = function (error) {
  console.error("🚨 WebSocket error:", error)
}
```

#### Browser Developer Tools

1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter by "WS" to see WebSocket connections
4. Inspect frames to see sent/received messages
5. Check Console for error messages

### 2. Server-Side Debugging

#### Cloudflare Workers Logs

```bash
# View live logs during development
wrangler tail

# View logs for deployed worker
wrangler tail --env production
```

#### Log Analysis

Look for these patterns in logs:

- Connection establishment and cleanup
- Error messages and stack traces
- Memory usage warnings
- Rate limiting indicators

### 3. Network Debugging

#### Test Connection Quality

```bash
# Test basic connectivity
curl -v https://your-worker.your-subdomain.workers.dev/

# Check DNS resolution
nslookup your-worker.your-subdomain.workers.dev

# Test WebSocket connectivity
# Use online WebSocket testing tools or command line tools
```

## Performance Issues

### 1. High Memory Usage

**Symptoms**: Worker exceeding memory limits
**Causes**: Too many concurrent connections
**Solutions**:

- Monitor connection counts with `/ws-stats` endpoint
- Implement connection limits on client side
- Use connection pooling strategies

### 2. Slow Message Delivery

**Symptoms**: Delayed message receipt
**Causes**: Network latency or server overload
**Solutions**:

- Optimize message size (keep under 1000 characters)
- Implement message batching for high-frequency updates
- Use appropriate WebSocket ping intervals

### 3. Connection Limits

**Symptoms**: New connections failing
**Causes**: Cloudflare Workers resource limits
**Solutions**:

- Monitor concurrent connections
- Implement connection queuing on client side
- Use multiple worker instances if needed

## Diagnostic Tools and Commands

### 1. Health Check Commands

```bash
# Check worker health
curl https://your-worker.your-subdomain.workers.dev/health

# Check WebSocket stats
curl https://your-worker.your-subdomain.workers.dev/ws-stats

# Verify basic connectivity
curl https://your-worker.your-subdomain.workers.dev/
```

### 2. WebSocket Testing

```bash
# Using wscat (install with npm install -g wscat)
wscat -c wss://your-worker.your-subdomain.workers.dev/websocket

# Send test message
{"type": "message", "content": "Test message"}

# Request user info
{"type": "user_info"}
```

### 3. Log Monitoring

```bash
# Watch live logs
wrangler tail --format pretty

# Filter logs by specific events
wrangler tail --env production | grep -i error
```

## Recovery Procedures

### 1. Connection Recovery

```javascript
// Robust reconnection strategy
class ReliableWebSocket {
  constructor(url) {
    this.url = url
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.reconnectAttempts = 0
    this.backoffMultiplier = 1.5

    this.connect()
  }

  connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log("✅ Connected successfully")
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000 // Reset delay on successful connection
    }

    this.ws.onclose = (event) => {
      if (event.wasClean) {
        console.log("✅ Connection closed cleanly")
      } else {
        console.warn("⚠️ Connection died, attempting to reconnect...")
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error("🚨 WebSocket error:", error)
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < 10) {
      // Limit retries
      this.reconnectAttempts++
      const delay = Math.min(
        this.reconnectDelay *
          Math.pow(this.backoffMultiplier, this.reconnectAttempts),
        this.maxReconnectDelay
      )

      console.log(
        `🔄 Scheduled reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
      )

      setTimeout(() => this.connect(), delay)
    } else {
      console.error("❌ Max reconnection attempts reached, giving up")
    }
  }
}
```

### 2. Message Recovery

```javascript
// Message queue for failed deliveries
class MessageQueue {
  constructor(websocket) {
    this.ws = websocket
    this.queue = []
    this.processing = false

    this.ws.onopen = () => {
      this.processQueue()
    }
  }

  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch (error) {
        console.error("Send failed, queuing message:", error)
        this.queue.push(message)
      }
    } else {
      this.queue.push(message)
    }
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const message = this.queue.shift()
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message))
          await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
        } else {
          this.queue.unshift(message) // Put back if not ready
          break
        }
      } catch (error) {
        console.error("Failed to send queued message:", error)
        this.queue.unshift(message) // Put back failed message
        break
      }
    }

    this.processing = false
  }
}
```

## Prevention Best Practices

### 1. Client-Side Best Practices

- Always implement proper error handling
- Use connection state management
- Implement message validation before sending
- Add reconnection logic with exponential backoff
- Monitor connection health actively

### 2. Server-Side Best Practices

- Monitor memory usage and connection counts
- Implement proper cleanup mechanisms
- Use appropriate heartbeat intervals
- Log errors for debugging
- Validate all incoming messages

### 3. Network Best Practices

- Use secure WebSocket connections (wss://)
- Implement proper timeout handling
- Monitor network latency
- Use CDN for static assets when possible

## Support Resources

### 1. Cloudflare Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [WebSocket Support](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [Troubleshooting Guide](https://developers.cloudflare.com/workers/learning/troubleshooting/)

### 2. Hono Framework

- [Hono Documentation](https://hono.dev/)
- [WebSocket Integration](https://hono.dev/docs/getting-started/websocket)

### 3. Emergency Contacts

- Cloudflare Support: https://support.cloudflare.com/
- Community Forums: https://community.cloudflare.com/
- Worker Logs: Use `wrangler tail` for real-time debugging

Remember to always test error scenarios in development before deploying to production, and maintain comprehensive logging for effective troubleshooting.
