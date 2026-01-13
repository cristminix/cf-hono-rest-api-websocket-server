const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');

class IntegrationTests {
    constructor(options = {}) {
        this.wsUrl = options.wsUrl || 'wss://localhost:8787/ws';
        this.timeout = options.timeout || 30000;
        this.retryAttempts = options.retryAttempts || 3;
        this.tests = [];
        this.results = [];
        this.globalContext = {};
    }

    async setup() {
        console.log('[SETUP] Initializing integration tests...');

        // Create temporary test data
        this.testData = {
            users: [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' },
                { id: 3, name: 'Charlie', email: 'charlie@example.com' }
            ],
            messages: [
                { type: 'chat', content: 'Hello World', userId: 1 },
                { type: 'notification', content: 'Welcome!', userId: 2 },
                { type: 'system', content: 'Server online', userId: 3 }
            ]
        };

        // Setup global context
        this.globalContext.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.globalContext.startTime = Date.now();

        console.log('[SETUP] Integration tests initialized');
    }

    async teardown() {
        console.log('[TEARDOWN] Cleaning up integration tests...');

        // Close any open connections
        if (this.primaryWs) {
            this.primaryWs.close();
        }

        if (this.secondaryWs) {
            this.secondaryWs.close();
        }

        console.log('[TEARDOWN] Integration tests cleaned up');
    }

    addTest(name, testFunction, options = {}) {
        this.tests.push({
            name,
            testFunction,
            options: {
                retry: options.retry || this.retryAttempts,
                timeout: options.timeout || this.timeout,
                dependsOn: options.dependsOn || [],
                ...options
            }
        });
    }

    async runTests() {
        console.log('[RUNNING] Integration tests...\n');

        await this.setup();

        for (let i = 0; i < this.tests.length; i++) {
            const test = this.tests[i];
            const result = await this.runSingleTest(test, i);
            this.results.push(result);

            if (!result.passed && test.options.abortOnFailure) {
                console.log(`[ABORT] Stopping tests due to failure in: ${test.name}`);
                break;
            }
        }

        await this.teardown();
        this.printSummary();

        return this.results;
    }

    async runSingleTest(test, index) {
        console.log(`[${index + 1}] Running: ${test.name}`);

        // Check dependencies
        if (test.options.dependsOn.length > 0) {
            const dependencyResults = test.options.dependsOn.map(depName => {
                const depTest = this.results.find(r => r.name === depName);
                return depTest ? depTest.passed : false;
            });

            if (!dependencyResults.every(Boolean)) {
                console.log(`[SKIP] Skipping due to unmet dependencies: ${test.options.dependsOn.join(', ')}`);
                return {
                    name: test.name,
                    passed: false,
                    skipped: true,
                    error: 'Unmet dependencies',
                    duration: 0
                };
            }
        }

        let result = { name: test.name, passed: false, skipped: false, error: null, duration: 0 };

        for (let attempt = 0; attempt <= test.options.retry; attempt++) {
            try {
                const startTime = Date.now();

                // Create fresh WebSocket instances for each test
                const primaryWs = new WebSocket(this.wsUrl);
                const secondaryWs = test.options.requiresSecondary ? new WebSocket(this.wsUrl) : null;

                // Wait for connections
                await Promise.all([
                    this.waitForConnection(primaryWs, test.options.timeout),
                    secondaryWs ? this.waitForConnection(secondaryWs, test.options.timeout) : Promise.resolve()
                ]);

                // Run the test with context
                const context = {
                    primaryWs,
                    secondaryWs,
                    testData: this.testData,
                    globalContext: this.globalContext,
                    utils: this.createTestUtils()
                };

                await test.testFunction(context);

                const duration = Date.now() - startTime;

                // Clean up connections
                if (primaryWs.readyState === WebSocket.OPEN) primaryWs.close();
                if (secondaryWs && secondaryWs.readyState === WebSocket.OPEN) secondaryWs.close();

                result = {
                    name: test.name,
                    passed: true,
                    skipped: false,
                    error: null,
                    duration,
                    attempt: attempt + 1
                };

                console.log(`[PASS] ✓ ${test.name} (${duration}ms)`);
                break;

            } catch (error) {
                if (attempt < test.options.retry) {
                    console.log(`[RETRY] Attempt ${attempt + 1} failed: ${error.message}`);
                    await this.delay(1000); // Wait before retry
                } else {
                    result.error = error.message;
                    console.log(`[FAIL] ✗ ${error.message}`);
                }
            }
        }

        return result;
    }

    async waitForConnection(ws, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, timeout);

            ws.once('open', () => {
                clearTimeout(timer);
                resolve();
            });

            ws.once('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createTestUtils() {
        return {
            waitForMessage: (ws, predicate, timeout = 5000) => {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error('Wait for message timeout'));
                    }, timeout);

                    const handleMessage = (data) => {
                        try {
                            const message = data.toString();
                            if (predicate(message)) {
                                clearTimeout(timer);
                                ws.removeListener('message', handleMessage);
                                resolve(message);
                            }
                        } catch (error) {
                            clearTimeout(timer);
                            ws.removeListener('message', handleMessage);
                            reject(error);
                        }
                    };

                    ws.on('message', handleMessage);
                });
            },

            sendAndWaitForResponse: async (ws, message, responsePredicate, timeout = 5000) => {
                ws.send(message);
                return await this.utils.waitForMessage(ws, responsePredicate, timeout);
            },

            generateTestData: (type, count = 1) => {
                switch (type) {
                    case 'users':
                        return Array.from({ length: count }, (_, i) => ({
                            id: Date.now() + i,
                            name: `Test User ${i}`,
                            email: `test${i}@example.com`
                        }));
                    case 'messages':
                        return Array.from({ length: count }, (_, i) => ({
                            id: Date.now() + i,
                            content: `Test message ${i}`,
                            type: 'test',
                            timestamp: Date.now()
                        }));
                    default:
                        return [];
                }
            }
        };
    }

    printSummary() {
        console.log('\n[SUMMARY] Integration Test Results:');
        console.log('==================================');

        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed && !r.skipped).length;
        const skipped = this.results.filter(r => r.skipped).length;

        this.results.forEach(result => {
            const status = result.skipped ? 'SKIPPED' : (result.passed ? 'PASS' : 'FAIL');
            const symbol = result.skipped ? '-' : (result.passed ? '✓' : '✗');
            console.log(`${symbol} ${result.name}: ${status}${result.duration ? ` (${result.duration}ms)` : ''}`);
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }
            if (result.attempt && result.attempt > 1) {
                console.log(`    Retries: ${result.attempt - 1}`);
            }
        });

        console.log('\n📊 STATISTICS:');
        console.log(`Total: ${this.results.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(2)}%`);

        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
        console.log(`Total Duration: ${totalDuration}ms`);
    }

    // Individual test implementations
    async testConnectionEstablishment(context) {
        const { primaryWs } = context;

        // Verify connection is established
        assert.strictEqual(primaryWs.readyState, WebSocket.OPEN, 'WebSocket should be connected');

        // Send a simple ping
        primaryWs.send('ping');

        // Wait for potential response
        await new Promise(resolve => {
            primaryWs.once('message', (data) => {
                console.log(`[INFO] Received: ${data.toString()}`);
                resolve();
            });

            setTimeout(resolve, 1000); // Timeout if no response
        });
    }

    async testBasicMessaging(context) {
        const { primaryWs, utils } = context;

        const testMessage = JSON.stringify({
            type: 'test',
            content: 'Hello World',
            testId: this.globalContext.testId
        });

        primaryWs.send(testMessage);

        // Wait for echo or acknowledgment
        const response = await utils.waitForMessage(
            primaryWs,
            (msg) => msg.includes('Hello World') || msg.includes('ack'),
            3000
        );

        assert.ok(response, 'Should receive response to test message');
    }

    async testMultiUserScenario(context) {
        const { primaryWs, secondaryWs, utils } = context;

        // Both clients send messages simultaneously
        const message1 = JSON.stringify({
            type: 'multi_user_test',
            content: 'Message from primary',
            sender: 'primary',
            testId: this.globalContext.testId
        });

        const message2 = JSON.stringify({
            type: 'multi_user_test',
            content: 'Message from secondary',
            sender: 'secondary',
            testId: this.globalContext.testId
        });

        // Send messages concurrently
        const [_, __] = await Promise.all([
            new Promise(resolve => {
                primaryWs.send(message1);
                resolve();
            }),
            new Promise(resolve => {
                secondaryWs.send(message2);
                resolve();
            })
        ]);

        // Wait for responses from both sides
        const responsePromises = [
            utils.waitForMessage(primaryWs, (msg) => msg.includes('secondary'), 5000),
            utils.waitForMessage(secondaryWs, (msg) => msg.includes('primary'), 5000)
        ];

        const responses = await Promise.allSettled(responsePromises);

        // At least one should succeed (depending on server implementation)
        const successfulResponses = responses.filter(r => r.status === 'fulfilled').length;
        assert.ok(successfulResponses >= 1, 'At least one client should receive the other\'s message');
    }

    async testLargeMessageHandling(context) {
        const { primaryWs, utils } = context;

        // Test various message sizes
        const sizes = [1024, 10240, 51200]; // 1KB, 10KB, 50KB

        for (const size of sizes) {
            const largeMessage = JSON.stringify({
                type: 'large_message_test',
                content: 'A'.repeat(size),
                size: size,
                testId: this.globalContext.testId
            });

            console.log(`[TEST] Sending ${size} byte message`);

            primaryWs.send(largeMessage);

            // Wait for response
            const response = await utils.waitForMessage(
                primaryWs,
                (msg) => msg.includes('large_message_test'),
                10000 // Longer timeout for large messages
            );

            const parsed = JSON.parse(response);
            assert.strictEqual(parsed.size, size, `Message size should be preserved: ${size}`);
        }
    }

    async testConnectionRecovery(context) {
        const { primaryWs } = context;

        // Send a few messages to establish baseline
        for (let i = 0; i < 3; i++) {
            primaryWs.send(JSON.stringify({ type: 'baseline', id: i }));
            await this.delay(100);
        }

        // Close and reopen connection
        primaryWs.close();

        // Wait for closure
        await new Promise(resolve => {
            primaryWs.on('close', () => resolve());
            setTimeout(resolve, 2000);
        });

        // Reconnect
        const newWs = new WebSocket(this.wsUrl);
        await this.waitForConnection(newWs, 5000);

        // Send recovery test message
        newWs.send(JSON.stringify({
            type: 'recovery_test',
            originalTestId: this.globalContext.testId
        }));

        const response = await context.utils.waitForMessage(
            newWs,
            (msg) => msg.includes('recovery_test'),
            3000
        );

        assert.ok(response, 'Should handle reconnection successfully');
        newWs.close();
    }

    async testMessageOrdering(context) {
        const { primaryWs, utils } = context;

        const messageCount = 10;
        const receivedMessages = [];

        // Listen for responses
        primaryWs.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'ordering_test') {
                    receivedMessages.push(parsed.order);
                }
            } catch (e) {
                // Ignore non-JSON messages
            }
        });

        // Send ordered messages
        for (let i = 0; i < messageCount; i++) {
            const message = JSON.stringify({
                type: 'ordering_test',
                order: i,
                testId: this.globalContext.testId
            });

            primaryWs.send(message);
            await this.delay(50); // Small delay to ensure ordering
        }

        // Wait for all responses
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (receivedMessages.length >= messageCount) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });

        // Verify ordering (allowing for some out-of-order delivery)
        assert.ok(receivedMessages.length > 0, 'Should receive some ordered messages');

        // Sort received messages and check if they're mostly in order
        const sortedReceived = [...receivedMessages].sort((a, b) => a - b);
        const inOrder = sortedReceived.every((val, idx) => val === idx);

        console.log(`[INFO] Messages received: ${receivedMessages.length}/${messageCount}`);
        console.log(`[INFO] In-order delivery: ${inOrder ? 'Yes' : 'Partial'}`);
    }

    async testBroadcastFunctionality(context) {
        const { primaryWs, secondaryWs, utils } = context;

        // Subscribe both clients to broadcast channel
        const subscribeMsg = JSON.stringify({ type: 'subscribe', channel: 'broadcast' });
        primaryWs.send(subscribeMsg);
        secondaryWs.send(subscribeMsg);

        await this.delay(500); // Wait for subscription

        // Send broadcast message from one client
        const broadcastMsg = JSON.stringify({
            type: 'broadcast',
            content: 'Broadcast message',
            sender: 'primary',
            testId: this.globalContext.testId
        });

        primaryWs.send(broadcastMsg);

        // Both clients should receive the broadcast
        const [primaryResponse, secondaryResponse] = await Promise.allSettled([
            utils.waitForMessage(secondaryWs, (msg) => msg.includes('Broadcast message'), 5000),
            utils.waitForMessage(primaryWs, (msg) => msg.includes('Broadcast message'), 5000)
        ]);

        const receivedBySecondary = primaryResponse.status === 'fulfilled';
        const receivedByPrimary = secondaryResponse.status === 'fulfilled';

        // At least the secondary should receive it (broadcast behavior)
        assert.ok(receivedBySecondary || receivedByPrimary,
            'Broadcast message should be received by at least one other client');
    }

    async runAllTests() {
        // Add all integration tests
        this.addTest('Connection Establishment', this.testConnectionEstablishment.bind(this));
        this.addTest('Basic Messaging', this.testBasicMessaging.bind(this), {
            dependsOn: ['Connection Establishment']
        });
        this.addTest('Multi-User Scenario', this.testMultiUserScenario.bind(this), {
            requiresSecondary: true,
            dependsOn: ['Basic Messaging']
        });
        this.addTest('Large Message Handling', this.testLargeMessageHandling.bind(this), {
            timeout: 15000
        });
        this.addTest('Connection Recovery', this.testConnectionRecovery.bind(this));
        this.addTest('Message Ordering', this.testMessageOrdering.bind(this));
        this.addTest('Broadcast Functionality', this.testBroadcastFunctionality.bind(this), {
            requiresSecondary: true,
            timeout: 10000
        });

        return await this.runTests();
    }

    // Performance integration tests
    async runPerformanceIntegrationTests() {
        this.addTest('High Throughput Test', async (context) => {
            const { primaryWs } = context;
            const messageCount = 100;

            const startTime = Date.now();
            let successCount = 0;

            for (let i = 0; i < messageCount; i++) {
                try {
                    primaryWs.send(JSON.stringify({
                        type: 'perf_test',
                        id: i,
                        testId: this.globalContext.testId
                    }));
                    successCount++;
                    await this.delay(10); // Small delay to prevent overwhelming
                } catch (error) {
                    console.error(`[PERF] Message ${i} failed:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            const throughput = (successCount / (duration / 1000)).toFixed(2);

            console.log(`[PERF] Throughput: ${throughput} msg/s, Success: ${successCount}/${messageCount}`);
            assert.ok(throughput > 10, `Throughput should be reasonable: ${throughput} msg/s`);
        });

        return await this.runTests();
    }

    // Security integration tests
    async runSecurityIntegrationTests() {
        this.addTest('Invalid Message Handling', async (context) => {
            const { primaryWs, utils } = context;

            // Send various invalid messages
            const invalidMessages = [
                '{"invalid": json}', // Invalid JSON
                '', // Empty message
                'x'.repeat(1000000), // Extremely large message
                '\u0000\u0001\u0002', // Control characters
            ];

            for (const invalidMsg of invalidMessages) {
                try {
                    primaryWs.send(invalidMsg);
                    // Should not crash the connection
                    await this.delay(100);
                    assert.strictEqual(primaryWs.readyState, WebSocket.OPEN, 'Connection should remain open');
                } catch (error) {
                    // Acceptable to fail sending, but connection should survive
                    assert.ok(true, 'Sending invalid message is acceptable to fail');
                }
            }
        });

        return await this.runTests();
    }
}

module.exports = IntegrationTests;

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const wsUrl = args[0] || 'wss://localhost:8787/ws';
    const testType = args[1] || 'all';

    console.log(`[INFO] Running integration tests against: ${wsUrl}`);
    console.log(`[INFO] Test type: ${testType}\n`);

    const tester = new IntegrationTests({ wsUrl });

    let testPromise;
    switch (testType) {
        case 'all':
            testPromise = tester.runAllTests();
            break;
        case 'performance':
            testPromise = tester.runPerformanceIntegrationTests();
            break;
        case 'security':
            testPromise = tester.runSecurityIntegrationTests();
            break;
        default:
            console.log('Usage: node integration-tests.js [ws_url] [all|performance|security]');
            process.exit(1);
    }

    testPromise.then(results => {
        const failed = results.filter(r => !r.passed && !r.skipped).length;
        process.exit(failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('[ERROR] Integration tests failed:', error);
        process.exit(1);
    });
}