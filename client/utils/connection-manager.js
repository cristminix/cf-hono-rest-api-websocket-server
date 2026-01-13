// Note: This module expects WebSocket to be available globally or passed in
// For Node.js usage, you would need to import WebSocket separately where this is used

class ConnectionManager {
    constructor(options = {}) {
        this.options = {
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            reconnectDelay: options.reconnectDelay || 1000,
            exponentialBackoff: options.exponentialBackoff !== false,
            maxReconnectDelay: options.maxReconnectDelay || 30000,
            heartbeatInterval: options.heartbeatInterval || 30000,
            pingTimeout: options.pingTimeout || 10000,
            ...options
        };

        this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
        this.reconnectAttempts = 0;
        this.heartbeatTimer = null;
        this.pingTimeoutTimer = null;
        this.lastHeartbeat = null;
        this.ws = null;
        this.url = null;

        // Callbacks
        this.onOpen = options.onOpen || (() => { });
        this.onClose = options.onClose || (() => { });
        this.onError = options.onError || (() => { });
        this.onMessage = options.onMessage || (() => { });
        this.onReconnect = options.onReconnect || (() => { });
        this.onReconnectFailed = options.onReconnectFailed || (() => { });
    }

    async connect(url, protocols = []) {
        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            console.warn('[CONNECTION] Already connected or connecting');
            return;
        }

        this.url = url;
        this.connectionState = 'connecting';

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url, protocols);

                this.ws.onopen = (event) => {
                    this.connectionState = 'connected';
                    this.reconnectAttempts = 0;
                    this.lastHeartbeat = Date.now();
                    this.startHeartbeat();

                    console.log('[CONNECTION] Connected successfully');
                    this.onOpen(event);
                    resolve();
                };

                this.ws.onclose = (event) => {
                    this.connectionState = 'disconnected';
                    this.stopHeartbeat();

                    console.log(`[CONNECTION] Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                    this.handleDisconnection(event);
                    this.onClose(event);
                };

                this.ws.onerror = (error) => {
                    console.error('[CONNECTION] WebSocket error:', error.message);
                    this.onError(error);
                };

                this.ws.onmessage = (event) => {
                    // Handle heartbeat responses
                    if (event.data === 'pong') {
                        this.lastHeartbeat = Date.now();
                        if (this.pingTimeoutTimer) {
                            clearTimeout(this.pingTimeoutTimer);
                            this.pingTimeoutTimer = null;
                        }
                        return;
                    }

                    this.onMessage(event);
                };
            } catch (error) {
                this.connectionState = 'disconnected';
                console.error('[CONNECTION] Failed to create WebSocket:', error.message);
                reject(error);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client initiated disconnect');
            this.connectionState = 'disconnected';
            this.stopHeartbeat();
        }
    }

    handleDisconnection(event) {
        if (this.shouldAttemptReconnect(event)) {
            this.attemptReconnect();
        } else {
            console.log('[CONNECTION] Not attempting to reconnect based on close event');
        }
    }

    shouldAttemptReconnect(closeEvent) {
        // Don't reconnect for normal closures (1000) or client errors (4000-4999)
        if (closeEvent.code === 1000 || (closeEvent.code >= 4000 && closeEvent.code < 5000)) {
            return false;
        }

        // Don't reconnect if we've exceeded max attempts
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            return false;
        }

        return true;
    }

    async attemptReconnect() {
        if (this.connectionState === 'reconnecting' || !this.url) {
            return;
        }

        this.reconnectAttempts++;
        this.connectionState = 'reconnecting';

        const delay = this.calculateReconnectDelay();

        console.log(`[RECONNECT] Attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}, waiting ${delay}ms`);

        this.onReconnect({
            attempt: this.reconnectAttempts,
            maxAttempts: this.options.maxReconnectAttempts,
            delay: delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));

        if (this.reconnectAttempts <= this.options.maxReconnectAttempts) {
            try {
                await this.connect(this.url);
            } catch (error) {
                console.error('[RECONNECT] Failed to reconnect:', error.message);
                this.attemptReconnect(); // Try again
            }
        } else {
            console.log('[RECONNECT] Maximum reconnection attempts reached');
            this.onReconnectFailed({
                attempts: this.reconnectAttempts,
                maxAttempts: this.options.maxReconnectAttempts
            });
        }
    }

    calculateReconnectDelay() {
        let delay = this.options.reconnectDelay;

        if (this.options.exponentialBackoff) {
            delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        }

        // Cap the delay at maxReconnectDelay
        delay = Math.min(delay, this.options.maxReconnectDelay);

        // Add jitter to prevent thundering herd
        delay = delay * (0.5 + Math.random() * 0.5);

        return Math.floor(delay);
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing timer

        this.heartbeatTimer = setInterval(() => {
            if (this.connectionState === 'connected' && this.ws) {
                try {
                    this.ws.send('ping');

                    // Set timeout for pong response
                    this.pingTimeoutTimer = setTimeout(() => {
                        console.log('[HEARTBEAT] Ping timeout, disconnecting');
                        this.ws.close(1006, 'Heartbeat timeout');
                    }, this.options.pingTimeout);
                } catch (error) {
                    console.error('[HEARTBEAT] Failed to send ping:', error.message);
                }
            }
        }, this.options.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.pingTimeoutTimer) {
            clearTimeout(this.pingTimeoutTimer);
            this.pingTimeoutTimer = null;
        }
    }

    getConnectionState() {
        return {
            state: this.connectionState,
            reconnectAttempts: this.reconnectAttempts,
            lastHeartbeat: this.lastHeartbeat,
            url: this.url,
            readyState: this.ws ? this.ws.readyState : null
        };
    }

    // Enhanced connection validation
    validateConnection() {
        if (!this.ws) {
            return { valid: false, reason: 'No WebSocket instance' };
        }

        if (this.ws.readyState !== WebSocket.OPEN) {
            return { valid: false, reason: `Invalid ready state: ${this.ws.readyState}` };
        }

        // Check if connection is stale (no heartbeat for too long)
        if (this.lastHeartbeat) {
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
            if (timeSinceLastHeartbeat > this.options.heartbeatInterval * 2) {
                return { valid: false, reason: 'Connection appears stale (no recent heartbeat)' };
            }
        }

        return { valid: true, reason: 'Connection is healthy' };
    }

    // Graceful reconnection
    async reconnectGracefully() {
        if (this.ws) {
            this.ws.close(1000, 'Reconnecting gracefully');
        }

        // Reset reconnect attempts to allow immediate reconnection
        this.reconnectAttempts = 0;

        // Wait a moment before reconnecting
        await new Promise(resolve => setTimeout(resolve, 100));

        if (this.url) {
            return this.connect(this.url);
        }
    }

    // Connection recovery strategies
    async recoverConnection(strategy = 'graceful') {
        switch (strategy) {
            case 'graceful':
                return this.reconnectGracefully();
            case 'force':
                this.disconnect();
                return this.connect(this.url);
            case 'reconnect':
                if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
                    this.reconnectAttempts = Math.max(0, this.reconnectAttempts - 1); // Reduce attempt count
                    return this.attemptReconnect();
                }
                break;
            default:
                throw new Error(`Unknown recovery strategy: ${strategy}`);
        }
    }

    // Event listener management
    addEventListener(type, listener) {
        if (this.ws) {
            this.ws.addEventListener(type, listener);
        }
    }

    removeEventListener(type, listener) {
        if (this.ws) {
            this.ws.removeEventListener(type, listener);
        }
    }

    // Send with connection validation
    send(data) {
        const validation = this.validateConnection();

        if (!validation.valid) {
            console.warn(`[SEND] Cannot send: ${validation.reason}`);

            // Attempt recovery if connection is invalid
            this.recoverConnection('reconnect').catch(err => {
                console.error('[SEND] Recovery failed:', err.message);
            });

            throw new Error(`Cannot send data: ${validation.reason}`);
        }

        this.ws.send(data);
    }

    // Batch send with queue management
    async batchSend(messages, options = {}) {
        const { delay = 0, validateEach = false } = options;

        for (let i = 0; i < messages.length; i++) {
            if (validateEach) {
                const validation = this.validateConnection();
                if (!validation.valid) {
                    throw new Error(`Batch send failed at message ${i}: ${validation.reason}`);
                }
            }

            this.send(messages[i]);

            if (delay > 0 && i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

export default ConnectionManager;

// Usage example
if (import.meta.url === `file://${process.argv[1]}`) {
    // Note: WebSocket needs to be imported where this is used in real applications
    // For example: import WebSocket from 'ws';

    const manager = new ConnectionManager({
        maxReconnectAttempts: 3,
        reconnectDelay: 1000,
        heartbeatInterval: 15000,
        onOpen: (event) => console.log('[EVENT] Opened:', event),
        onClose: (event) => console.log('[EVENT] Closed:', event),
        onError: (error) => console.error('[EVENT] Error:', error),
        onMessage: (event) => console.log('[EVENT] Message:', event.data),
        onReconnect: (info) => console.log('[EVENT] Reconnecting:', info),
        onReconnectFailed: (info) => console.log('[EVENT] Reconnect failed:', info)
    });

    // Example usage:
    // manager.connect('wss://example.com/ws').catch(console.error);
}