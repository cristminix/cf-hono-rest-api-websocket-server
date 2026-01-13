# Usage Examples and Testing Instructions

## Quick Start Examples

### 1. Connecting to WebSocket Server

#### Browser JavaScript Example

```javascript
// Connect to the WebSocket server
const ws = new WebSocket(
  "wss://your-worker.your-subdomain.workers.dev/websocket"
)

// Handle connection opening
ws.onopen = function (event) {
  console.log("Connected to WebSocket server")
  console.log("Connection established successfully")
}

// Handle incoming messages
ws.onmessage = function (event) {
  try {
    const message = JSON.parse(event.data)
    console.log("Received message:", message)

    // Handle different message types
    switch (message.type) {
      case "welcome":
        console.log("Welcome message received:", message)
        break
      case "message":
        console.log(
          "Chat message from",
          message.connectionId,
          ":",
          message.content
        )
        break
      case "user_joined":
        console.log("New user joined:", message.connectionId)
        console.log("Total users now:", message.totalUsers)
        break
      case "user_left":
        console.log("User left:", message.connectionId)
        console.log("Total users now:", message.totalUsers)
        break
      case "ping":
        console.log("Received ping from server")
        // Server handles pong automatically, but you can log it
        break
      case "error":
        console.log("Error received:", message.message)
        break
      default:
        console.log("Unknown message type:", message.type)
    }
  } catch (error) {
    console.log("Received plain text message:", event.data)
  }
}

// Handle connection close
ws.onclose = function (event) {
  console.log("WebSocket connection closed")
  console.log("Code:", event.code, "Reason:", event.reason)
}

// Handle connection errors
ws.onerror = function (error) {
  console.error("WebSocket error:", error)
}
```

#### Node.js Example

```javascript
const WebSocket = require("ws")

// Connect to the WebSocket server
const ws = new WebSocket(
  "wss://your-worker.your-subdomain.workers.dev/websocket"
)

ws.on("open", function open() {
  console.log("Connected to WebSocket server")
})

ws.on("message", function message(data) {
  try {
    const message = JSON.parse(data.toString())
    console.log("Received message:", message)
  } catch (error) {
    console.log("Received plain text:", data.toString())
  }
})

ws.on("close", function close(code, reason) {
  console.log("Connection closed:", code, reason)
})

ws.on("error", function error(err) {
  console.error("WebSocket error:", err)
})
```

### 2. Sending Messages

#### Text Messages

```javascript
// Send a regular message to other connected clients
const textMessage = {
  type: "message",
  content: "Hello, everyone!",
}

ws.send(JSON.stringify(textMessage))

// Send a message with special characters
const specialMessage = {
  type: "message",
  content: "Hello! This message has emojis: 🚀✨🎉",
}

ws.send(JSON.stringify(specialMessage))
```

#### Broadcast Messages

```javascript
// Send a message to ALL connected clients (including yourself)
const broadcastMessage = {
  type: "broadcast",
  content: "System announcement: Server maintenance scheduled.",
}

ws.send(JSON.stringify(broadcastMessage))
```

#### Request User Information

```javascript
// Request connection information from the server
const userInfoRequest = {
  type: "user_info",
}

ws.send(JSON.stringify(userInfoRequest))
```

## Testing Instructions

### Local Development Testing

#### 1. Start Local Development Server

```bash
# Navigate to your project directory
cd cf-worker-02

# Start the development server
npm run dev
```

This will start the worker on `http://localhost:8787` by default.

#### 2. Test HTTP Endpoints

```bash
# Test basic endpoint
curl http://localhost:8787/

# Test health endpoint
curl http://localhost:8787/health

# Test WebSocket stats
curl http://localhost:8787/ws-stats
```

#### 3. Test WebSocket Connection Locally

```javascript
// Connect to local development server
const ws = new WebSocket("ws://localhost:8787/websocket")

ws.onopen = () => {
  console.log("Connected to local development server")

  // Send a test message after connection
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: "message",
        content: "Test message from local client",
      })
    )
  }, 1000)
}

ws.onmessage = (event) => {
  console.log("Received from server:", event.data)
}
```

### Production Testing

#### 1. Deploy and Test

```bash
# Deploy to Cloudflare
npm run deploy

# Test the deployed endpoints
curl https://your-worker.your-subdomain.workers.dev/health
```

#### 2. WebSocket Load Testing

```javascript
// Multiple concurrent connections test
const connections = []

// Create multiple connections
for (let i = 0; i < 5; i++) {
  const ws = new WebSocket(
    "wss://your-worker.your-subdomain.workers.dev/websocket"
  )

  ws.onopen = function () {
    console.log(`Connection ${i + 1} opened`)

    // Send a message from each connection
    setTimeout(() => {
      ws.send(
        JSON.stringify({
          type: "message",
          content: `Message from connection ${i + 1}`,
        })
      )
    }, i * 1000)
  }

  ws.onmessage = function (event) {
    console.log(`Connection ${i + 1} received:`, event.data)
  }

  connections.push(ws)
}
```

## Integration Testing Examples

### 1. Chat Application Integration

```html
<!DOCTYPE html>
<html>
  <head>
    <title>WebSocket Chat Client</title>
  </head>
  <body>
    <div id="chat-container">
      <div id="messages"></div>
      <input
        type="text"
        id="message-input"
        placeholder="Type your message..."
      />
      <button onclick="sendMessage()">Send</button>
      <div id="status">Connecting...</div>
    </div>

    <script>
      let ws
      const messagesDiv = document.getElementById("messages")
      const messageInput = document.getElementById("message-input")
      const statusDiv = document.getElementById("status")

      function connect() {
        ws = new WebSocket(
          "wss://your-worker.your-subdomain.workers.dev/websocket"
        )

        ws.onopen = function () {
          statusDiv.textContent = "Connected"
          statusDiv.style.color = "green"
        }

        ws.onmessage = function (event) {
          const message = JSON.parse(event.data)
          displayMessage(message)
        }

        ws.onclose = function () {
          statusDiv.textContent = "Disconnected"
          statusDiv.style.color = "red"
        }

        ws.onerror = function (error) {
          console.error("WebSocket error:", error)
        }
      }

      function sendMessage() {
        const content = messageInput.value.trim()
        if (content) {
          ws.send(
            JSON.stringify({
              type: "message",
              content: content,
            })
          )
          messageInput.value = ""
        }
      }

      function displayMessage(message) {
        const messageElement = document.createElement("div")
        messageElement.className = "message"

        switch (message.type) {
          case "welcome":
            messageElement.textContent = `Welcome! Connection ID: ${message.connectionId}`
            break
          case "message":
            messageElement.textContent = `[${message.connectionId}] ${message.content}`
            break
          case "user_joined":
            messageElement.textContent = `User ${message.connectionId} joined (${message.totalUsers} total)`
            messageElement.style.fontStyle = "italic"
            messageElement.style.color = "green"
            break
          case "user_left":
            messageElement.textContent = `User ${message.connectionId} left (${message.totalUsers} remaining)`
            messageElement.style.fontStyle = "italic"
            messageElement.style.color = "red"
            break
          case "broadcast":
            messageElement.textContent = `[BROADCAST] ${message.content}`
            messageElement.style.fontWeight = "bold"
            break
          case "error":
            messageElement.textContent = `ERROR: ${message.message}`
            messageElement.style.color = "red"
            break
          default:
            messageElement.textContent = JSON.stringify(message)
        }

        messagesDiv.appendChild(messageElement)
        messagesDiv.scrollTop = messagesDiv.scrollHeight
      }

      // Handle Enter key press
      messageInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          sendMessage()
        }
      })

      // Connect when page loads
      window.onload = connect
    </script>

    <style>
      #chat-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }

      #messages {
        height: 400px;
        border: 1px solid #ccc;
        overflow-y: auto;
        padding: 10px;
        margin-bottom: 10px;
      }

      .message {
        margin: 5px 0;
        padding: 5px;
        border-radius: 4px;
      }

      #message-input {
        width: 70%;
        padding: 10px;
      }

      button {
        padding: 10px 20px;
        margin-left: 10px;
      }
    </style>
  </body>
</html>
```

### 2. Automated Testing Script

```javascript
// automated-test.js
const WebSocket = require("ws")
const assert = require("assert")

async function runTests() {
  console.log("Starting WebSocket tests...")

  // Test 1: Connection establishment
  await testConnection()

  // Test 2: Message sending and receiving
  await testMessaging()

  // Test 3: Multiple connections
  await testMultipleConnections()

  console.log("All tests passed!")
}

async function testConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://your-worker.your-subdomain.workers.dev/websocket"
    )

    let connected = false
    let receivedWelcome = false

    ws.onopen = () => {
      connected = true
      console.log("✓ Connection test: Connected successfully")
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === "welcome") {
          receivedWelcome = true
          console.log("✓ Connection test: Received welcome message")

          if (connected && receivedWelcome) {
            ws.close()
            resolve()
          }
        }
      } catch (error) {
        reject(new Error("Failed to parse welcome message"))
      }
    }

    ws.onerror = (error) => {
      reject(new Error("Connection failed: " + error.message))
    }

    setTimeout(() => {
      if (!connected) {
        reject(new Error("Connection timeout"))
      }
    }, 5000)
  })
}

async function testMessaging() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://your-worker.your-subdomain.workers.dev/websocket"
    )

    ws.onopen = () => {
      // Send a test message
      const testMessage = {
        type: "message",
        content: "Test message for validation",
      }
      ws.send(JSON.stringify(testMessage))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (
          message.type === "message" &&
          message.content.includes("Test message")
        ) {
          console.log(
            "✓ Messaging test: Message sent and received successfully"
          )
          ws.close()
          resolve()
        }
      } catch (error) {
        // Ignore non-JSON messages during test
      }
    }

    ws.onerror = (error) => {
      reject(new Error("Messaging test failed: " + error.message))
    }

    setTimeout(() => {
      reject(new Error("Messaging test timeout"))
    }, 5000)
  })
}

async function testMultipleConnections() {
  return new Promise((resolve, reject) => {
    const connections = []
    let joinNotifications = 0

    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(
        "wss://your-worker.your-subdomain.workers.dev/websocket"
      )

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === "user_joined") {
            joinNotifications++
            if (joinNotifications >= 2) {
              // Expecting 2 join notifications for 3 connections
              console.log(
                "✓ Multiple connections test: All connections detected"
              )

              // Close all connections
              connections.forEach((conn) => conn.close())
              resolve()
            }
          }
        } catch (error) {
          // Ignore non-JSON messages
        }
      }

      ws.onerror = (error) => {
        connections.forEach((conn) => conn.close())
        reject(new Error("Multiple connections test failed: " + error.message))
      }

      connections.push(ws)
    }

    setTimeout(() => {
      connections.forEach((conn) => conn.close())
      reject(new Error("Multiple connections test timeout"))
    }, 10000)
  })
}

// Run tests
runTests().catch(console.error)
```

## Performance Testing

### 1. Connection Stress Test

```javascript
// stress-test.js
const WebSocket = require("ws")

async function stressTest(maxConnections = 100) {
  const connections = []
  let connectedCount = 0
  let failedCount = 0

  console.log(`Starting stress test with ${maxConnections} connections...`)

  for (let i = 0; i < maxConnections; i++) {
    const ws = new WebSocket(
      "wss://your-worker.your-subdomain.workers.dev/websocket"
    )

    ws.onopen = () => {
      connectedCount++
      console.log(`Connected: ${connectedCount}/${maxConnections}`)
    }

    ws.onerror = (error) => {
      failedCount++
      console.log(`Failed: ${failedCount}/${maxConnections}`)
    }

    ws.onclose = () => {
      // Connection closed
    }

    connections.push(ws)

    // Delay between connections to avoid overwhelming
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Wait for all connections to settle
  await new Promise((resolve) => setTimeout(resolve, 5000))

  console.log(`Stress test results:`)
  console.log(`Successful connections: ${connectedCount}`)
  console.log(`Failed connections: ${failedCount}`)
  console.log(`Total attempted: ${maxConnections}`)
}

// Run stress test
stressTest(50) // Adjust number as needed
```

### 2. Message Throughput Test

```javascript
// throughput-test.js
const WebSocket = require("ws")

async function throughputTest() {
  const ws = new WebSocket(
    "wss://your-worker.your-subdomain.workers.dev/websocket"
  )

  let messageCount = 0
  const startTime = Date.now()
  const testDuration = 10000 // 10 seconds

  ws.onopen = () => {
    console.log("Starting throughput test...")

    // Send messages rapidly
    const interval = setInterval(() => {
      if (Date.now() - startTime < testDuration) {
        ws.send(
          JSON.stringify({
            type: "message",
            content: `Throughput test message ${++messageCount}`,
          })
        )
      } else {
        clearInterval(interval)
        const duration = (Date.now() - startTime) / 1000
        const messagesPerSecond = Math.round(messageCount / duration)

        console.log(`Throughput test results:`)
        console.log(`Messages sent: ${messageCount}`)
        console.log(`Duration: ${duration} seconds`)
        console.log(`Messages per second: ${messagesPerSecond}`)

        ws.close()
      }
    }, 10) // Send every 10ms
  }

  ws.onerror = (error) => {
    console.error("Throughput test error:", error)
  }
}

throughputTest()
```

## Common Usage Scenarios

### 1. Real-time Chat Application

- Multiple users connected simultaneously
- Message broadcasting to all users
- User join/leave notifications
- Connection management and cleanup

### 2. Live Data Streaming

- Real-time updates to connected clients
- Heartbeat mechanism for connection health
- Automatic reconnection handling

### 3. Multiplayer Game

- Player synchronization
- Real-time game state updates
- Connection validation and security

### 4. Collaborative Editing

- Real-time document updates
- Conflict resolution
- Presence indicators

## Testing Best Practices

### 1. Environment Setup

- Test both local development and production environments
- Use staging environment for pre-production testing
- Mock external dependencies during testing

### 2. Error Handling

- Test connection failures and timeouts
- Verify error message handling
- Test message validation and rejection

### 3. Performance Testing

- Load test with multiple concurrent connections
- Message throughput testing
- Memory usage monitoring
- Connection cleanup verification

### 4. Security Testing

- Test message injection attacks
- Validate input sanitization
- Test unauthorized access attempts
- Verify connection limits

Remember to replace `your-worker.your-subdomain.workers.dev` with your actual Cloudflare Workers domain before using these examples.
