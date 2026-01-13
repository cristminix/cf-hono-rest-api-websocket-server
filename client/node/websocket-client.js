const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class CloudflareWebSocketClient {
    constructor(options = {}) {
        this.url = options.url || 'wss://localhost:8787/ws';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.autoReconnect = options.autoReconnect !== false;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.stats = {
            sent: 0,
            received: 0,
            errors: 0,
            connections: 0,
            disconnections: 0
        };
        this.callbacks = {
            onOpen: options.onOpen || (() => { }),
            onClose: options.onClose || (() => { }),
            onError: options.onError || (() => { }),
            onMessage: options.onMessage || (() => { })
        };
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                this.stats.connections++;

                this.ws.on('open', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log(`[INFO] Connected to ${this.url}`);

                    // Send queued messages
                    while (this.messageQueue.length > 0) {
                        const { message, resolve: msgResolve, reject: msgReject } = this.messageQueue.shift();
                        this._sendMessage(message, msgResolve, msgReject);
                    }

                    this.callbacks.onOpen();
                    resolve();
                });

                this.ws.on('close', (code, reason) => {
                    this.isConnected = false;
                    this.stats.disconnections++;
                    console.log(`[INFO] Disconnected from ${this.url}. Code: ${code}, Reason: ${reason}`);

                    this.callbacks.onClose(code, reason);

                    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this._attemptReconnect();
                    }
                });

                this.ws.on('error', (error) => {
                    this.stats.errors++;
                    console.error('[ERROR]', error.message);
                    this.callbacks.onError(error);
                    reject(error);
                });

                this.ws.on('message', (data) => {
                    this.stats.received++;
                    this.callbacks.onMessage(data);
                });
            } catch (error) {
                console.error('[ERROR] Failed to create WebSocket:', error.message);
                reject(error);
            }
        });
    }

    _attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`[INFO] Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.connect().catch(err => {
                    console.error('[ERROR] Reconnection failed:', err.message);
                });
            } else {
                console.log('[INFO] Max reconnection attempts reached');
            }
        }, this.reconnectDelay);
    }

    async send(message, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || !this.isConnected) {
                if (options.queue !== false) {
                    this.messageQueue.push({ message, resolve, reject });
                    console.log('[INFO] Message queued for sending when connected');
                    return;
                } else {
                    reject(new Error('WebSocket is not connected'));
                    return;
                }
            }

            this._sendMessage(message, resolve, reject);
        });
    }

    _sendMessage(message, resolve, reject) {
        try {
            this.ws.send(message, (error) => {
                if (error) {
                    this.stats.errors++;
                    console.error('[ERROR] Failed to send message:', error.message);
                    reject(error);
                } else {
                    this.stats.sent++;
                    resolve();
                }
            });
        } catch (error) {
            this.stats.errors++;
            console.error('[ERROR] Send error:', error.message);
            reject(error);
        }
    }

    async sendWithAck(message, timeout = 5000) {
        return new Promise(async (resolve, reject) => {
            const messageId = `msg_${Date.now()}_${Math.random()}`;
            const payload = typeof message === 'string' ? message : JSON.stringify({ ...message, id: messageId });

            const timeoutId = setTimeout(() => {
                reject(new Error('Message acknowledgment timeout'));
            }, timeout);

            const originalOnMessage = this.callbacks.onMessage;
            this.callbacks.onMessage = (data) => {
                try {
                    const parsedData = JSON.parse(data.toString());
                    if (parsedData.ack && parsedData.id === messageId) {
                        clearTimeout(timeoutId);
                        this.callbacks.onMessage = originalOnMessage;
                        resolve(parsedData);
                    }
                } catch (e) {
                    // Not an ACK message, continue with original handler
                    if (originalOnMessage) {
                        originalOnMessage(data);
                    }
                }
            };

            try {
                await this.send(payload);
            } catch (error) {
                clearTimeout(timeoutId);
                this.callbacks.onMessage = originalOnMessage;
                reject(error);
            }
        });
    }

    async ping(timeout = 5000) {
        const startTime = performance.now();
        try {
            await this.sendWithAck('PING', timeout);
            const endTime = performance.now();
            const latency = endTime - startTime;
            console.log(`[INFO] Ping: ${latency.toFixed(2)}ms`);
            return latency;
        } catch (error) {
            console.error('[ERROR] Ping failed:', error.message);
            throw error;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
        }
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats() {
        this.stats = {
            sent: 0,
            received: 0,
            errors: 0,
            connections: 0,
            disconnections: 0
        };
    }

    // Test utilities
    async testConnection() {
        console.log('[TEST] Testing connection...');
        try {
            await this.connect();
            console.log('[TEST] ✓ Connection established');
            return true;
        } catch (error) {
            console.error('[TEST] ✗ Connection failed:', error.message);
            return false;
        }
    }

    async testMessageTypes() {
        console.log('[TEST] Testing different message types...');

        // Test text message
        try {
            await this.send('Hello World');
            console.log('[TEST] ✓ Text message sent');
        } catch (error) {
            console.error('[TEST] ✗ Text message failed:', error.message);
        }

        // Test JSON message
        try {
            await this.send(JSON.stringify({ test: 'json', value: 123 }));
            console.log('[TEST] ✓ JSON message sent');
        } catch (error) {
            console.error('[TEST] ✗ JSON message failed:', error.message);
        }

        // Test binary message
        try {
            const buffer = Buffer.from('Hello Binary', 'utf8');
            await this.send(buffer);
            console.log('[TEST] ✓ Binary message sent');
        } catch (error) {
            console.error('[TEST] ✗ Binary message failed:', error.message);
        }
    }

    async testPerformance(messageSize = 1024, messageCount = 100, interval = 10) {
        console.log(`[TEST] Performance test: ${messageCount} messages of ${messageSize} bytes, ${interval}ms interval`);

        const startTime = performance.now();
        const latencies = [];

        for (let i = 0; i < messageCount; i++) {
            const message = 'A'.repeat(messageSize);
            const sendTime = performance.now();

            try {
                await this.send(message);
                const receiveTime = performance.now();
                latencies.push(receiveTime - sendTime);
            } catch (error) {
                console.error(`[ERROR] Message ${i} failed:`, error.message);
            }

            if (i < messageCount - 1) {
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        const throughput = totalTime > 0 ? (messageCount / (totalTime / 1000)).toFixed(2) : 0;

        console.log(`[TEST] Results:`);
        console.log(`[TEST]   Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`[TEST]   Average latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`[TEST]   Throughput: ${throughput} msg/s`);
        console.log(`[TEST]   Messages sent: ${messageCount}`);
        console.log(`[TEST]   Messages received: ${this.getStats().received}`);

        return {
            totalTime,
            avgLatency,
            throughput,
            sent: messageCount,
            received: this.getStats().received
        };
    }

    async testReconnection() {
        console.log('[TEST] Testing reconnection logic...');

        const originalAutoReconnect = this.autoReconnect;
        this.autoReconnect = true;

        // Force disconnection
        if (this.ws) {
            this.ws.close();
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        this.autoReconnect = originalAutoReconnect;
    }

    async runAllTests() {
        console.log('[TEST] Starting comprehensive test suite...');

        await this.testConnection();
        await this.testMessageTypes();

        if (this.isConnected) {
            await this.testPerformance(1024, 10, 100);
            await this.ping();
        }

        await this.testReconnection();

        console.log('[TEST] Test suite completed');
        console.log('[STATS]', this.getStats());
    }
}

module.exports = CloudflareWebSocketClient;

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const url = args[0] || 'wss://localhost:8787/ws';

    const client = new CloudflareWebSocketClient({
        url: url,
        onMessage: (data) => {
            console.log('[MESSAGE]', data.toString());
        },
        onOpen: () => {
            console.log('[CONNECTION] WebSocket connected');
        },
        onClose: (code, reason) => {
            console.log(`[CONNECTION] WebSocket closed. Code: ${code}, Reason: ${reason}`);
        },
        onError: (error) => {
            console.error('[CONNECTION] WebSocket error:', error.message);
        }
    });

    // Handle command line arguments
    const command = args[1];

    switch (command) {
        case 'connect':
            client.connect()
                .then(() => console.log('[SUCCESS] Connected successfully'))
                .catch(err => console.error('[ERROR] Connection failed:', err.message));
            break;

        case 'send':
            const message = args[2] || 'Hello World';
            client.connect()
                .then(() => client.send(message))
                .then(() => console.log('[SUCCESS] Message sent'))
                .catch(err => console.error('[ERROR] Send failed:', err.message));
            break;

        case 'ping':
            client.connect()
                .then(() => client.ping())
                .catch(err => console.error('[ERROR] Ping failed:', err.message));
            break;

        case 'test':
            client.runAllTests();
            break;

        case 'perf':
            const messageSize = parseInt(args[2]) || 1024;
            const messageCount = parseInt(args[3]) || 100;
            client.connect()
                .then(() => client.testPerformance(messageSize, messageCount, 10))
                .catch(err => console.error('[ERROR] Performance test failed:', err.message));
            break;

        default:
            console.log('Usage:');
            console.log('  node websocket-client.js <url> connect    - Connect to WebSocket');
            console.log('  node websocket-client.js <url> send <msg> - Send a message');
            console.log('  node websocket-client.js <url> ping      - Send ping');
            console.log('  node websocket-client.js <url> test      - Run all tests');
            console.log('  node websocket-client.js <url> perf <size> <count> - Performance test');
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[INFO] Shutting down...');
        client.disconnect();
        process.exit(0);
    });
}