# Cloudflare Worker WebSocket Client

Comprehensive WebSocket client implementation for testing Cloudflare Worker WebSocket functionality. This client provides both browser-based and command-line interfaces with extensive testing capabilities.

## Features

### Browser Client (`client/browser/index.html`)

- **Real-time WebSocket interface** with connection management
- **Multiple message type support** (text, JSON, binary)
- **Performance testing tools** with configurable message size and rate
- **Automated test suites** for different scenarios
- **Connection monitoring** with detailed statistics
- **Reconnection logic** with configurable retry settings
- **Message validation** and response handling
- **Tabbed interface** for different testing modes

### Node.js Client (`client/node/websocket-client.js`)

- **Command-line interface** for automated testing
- **Programmatic API** for integration in test suites
- **Connection management** with automatic reconnection
- **Message queuing** for offline message handling
- **Performance testing** capabilities
- **Acknowledgment system** for reliable messaging
- **Comprehensive test suite** runner

### Test Suites (`client/tests/`)

- **Message Type Tests** - Validates different message formats
- **Integration Tests** - End-to-end scenario testing
- **Performance Tests** - Throughput and latency measurements

### Utilities (`client/utils/`)

- **Connection Manager** - Advanced connection handling
- **Message Validator** - Comprehensive message validation
- **Performance Tester** - Detailed performance analysis

## Installation

```bash
# Install dependencies for Node.js client
npm install ws
```

## Usage

### Browser Client

Simply open `client/browser/index.html` in your web browser. Configure the WebSocket URL and test parameters through the UI.

### Node.js Client

```bash
# Connect to WebSocket
node client/node/websocket-client.js wss://your-worker.your-subdomain.workers.dev/ws connect

# Send a message
node client/node/websocket-client.js wss://your-worker.your-subdomain.workers.dev/ws send "Hello World"

# Run ping test
node client/node/websocket-client.js wss://your-worker.your-subdomain.workers.dev/ws ping

# Run comprehensive tests
node client/node/websocket-client.js wss://your-worker.your-subdomain.workers.dev/ws test

# Performance test
node client/node/websocket-client.js wss://your-worker.your-subdomain.workers.dev/ws perf 1024 100
```

### Programmatic Usage

```javascript
const CloudflareWebSocketClient = require("./client/node/websocket-client.js")

const client = new CloudflareWebSocketClient({
  url: "wss://your-worker.your-subdomain.workers.dev/ws",
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  onMessage: (data) => {
    console.log("Received:", data.toString())
  },
})

await client.connect()
await client.send("Hello World")
await client.disconnect()
```

## Configuration Options

### Browser Client Settings

- **WebSocket URL**: Target WebSocket endpoint
- **Reconnect Attempts**: Number of reconnection attempts (default: 5)
- **Reconnect Delay**: Delay between reconnection attempts in ms (default: 1000)
- **Message Size**: Size of test messages in bytes
- **Message Count**: Number of test messages to send
- **Interval**: Delay between messages in ms

### Node.js Client Options

```javascript
{
    url: 'wss://your-worker.your-subdomain.workers.dev/ws',  // WebSocket URL
    maxReconnectAttempts: 5,                                  // Max reconnection attempts
    reconnectDelay: 1000,                                    // Delay between attempts (ms)
    autoReconnect: true,                                     // Enable auto-reconnection
    onOpen: () => {},                                       // Connection opened callback
    onClose: () => {},                                      // Connection closed callback
    onError: () => {},                                      // Error occurred callback
    onMessage: () => {}                                     // Message received callback
}
```

## Test Suites

### Message Type Tests

Validates different message types:

- Text messages
- JSON objects
- Binary data (ArrayBuffer, TypedArray, Buffer)
- Large messages (up to 100KB)
- Special characters and Unicode
- Message sequences
- Concurrent messages

Run with:

```bash
node client/tests/message-type-tests.js wss://your-worker.your-subdomain.workers.dev/ws
```

### Integration Tests

End-to-end scenario testing:

- Connection establishment and recovery
- Multi-user scenarios
- Large message handling
- Message ordering
- Broadcast functionality
- Connection stability

Run with:

```bash
# All tests
node client/tests/integration-tests.js wss://your-worker.your-subdomain.workers.dev/ws all

# Performance tests only
node client/tests/integration-tests.js wss://your-worker.your-subdomain.workers.dev/ws performance

# Security tests only
node client/tests/integration-tests.js wss://your-worker.your-subdomain.workers.dev/ws security
```

### Performance Testing

Measures:

- Latency (round-trip time)
- Throughput (messages per second)
- Memory usage
- Error rates
- Connection stability
- Bandwidth utilization

## API Reference

### WebSocket Client Methods

#### `connect()`

Establishes connection to WebSocket server.

#### `disconnect()`

Closes the WebSocket connection.

#### `send(message, options)`

Sends a message through the WebSocket.

- `message`: String, Buffer, or ArrayBuffer to send
- `options.queue`: Whether to queue message if not connected (default: true)

#### `sendWithAck(message, timeout)`

Sends message and waits for acknowledgment.

- `timeout`: Maximum time to wait for ACK (default: 5000ms)

#### `ping(timeout)`

Sends ping and measures round-trip time.

#### `getStats()`

Returns connection statistics.

#### `resetStats()`

Resets connection statistics.

#### `runAllTests()`

Runs comprehensive test suite.

### Connection Manager

Advanced connection handling with:

- Exponential backoff
- Heartbeat/ping-pong
- Connection validation
- Multiple recovery strategies

### Message Validator

Comprehensive message validation with:

- Predefined validation rules
- Custom validation functions
- JSON schema validation
- Size and pattern validation
- Validation chains

## Troubleshooting

### Common Issues

1. **Connection Refused**: Verify WebSocket URL and ensure worker is deployed
2. **SSL/TLS Errors**: Use `wss://` for production, `ws://` for local testing
3. **Message Loss**: Check network connectivity and server capacity
4. **Memory Leaks**: Monitor memory usage during long-running tests

### Debugging Tips

- Enable browser developer console for client-side debugging
- Use verbose logging in Node.js client
- Monitor WebSocket frames in browser network tab
- Check Cloudflare Worker logs for server-side issues

## Best Practices

### For Testing

- Start with basic functionality before complex scenarios
- Use realistic message sizes and frequencies
- Test edge cases (empty messages, very large messages)
- Verify reconnection behavior under network stress

### For Production

- Implement proper error handling
- Monitor connection health continuously
- Use appropriate timeout values
- Log important events for debugging

## Architecture

```
client/
├── browser/
│   └── index.html          # Browser-based WebSocket client
├── node/
│   └── websocket-client.js # Node.js WebSocket client
├── tests/
│   ├── message-type-tests.js    # Message format validation
│   └── integration-tests.js     # End-to-end testing
└── utils/
    ├── connection-manager.js    # Advanced connection handling
    ├── message-validator.js     # Message validation
    └── performance-tester.js    # Performance analysis
```

## License

MIT License - See LICENSE file for details.
