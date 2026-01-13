import WebSocket from 'ws';
import assert from 'assert';

class MessageTypeTests {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.tests = [];
        this.results = [];
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.on('open', () => {
                console.log('[CONNECTED] WebSocket connected for message type tests');
                resolve();
            });

            this.ws.on('error', (error) => {
                console.error('[ERROR] Connection failed:', error.message);
                reject(error);
            });

            this.ws.on('message', (data) => {
                this.handleReceivedMessage(data);
            });
        });
    }

    handleReceivedMessage(data) {
        // Store received message for validation
        this.lastReceivedMessage = data;
        this.receiveTimestamp = Date.now();
    }

    addTest(name, testFunction) {
        this.tests.push({ name, testFunction });
    }

    async runTests() {
        console.log('[RUNNING] Message type tests...\n');

        await this.connect();

        for (const test of this.tests) {
            try {
                console.log(`[TEST] Running: ${test.name}`);
                await test.testFunction.call(this);
                this.results.push({ name: test.name, status: 'PASS', error: null });
                console.log('[RESULT] ✓ PASS\n');
            } catch (error) {
                this.results.push({ name: test.name, status: 'FAIL', error: error.message });
                console.log(`[RESULT] ✗ FAIL: ${error.message}\n`);
            }
        }

        this.printSummary();
        this.ws.close();
    }

    printSummary() {
        console.log('[SUMMARY] Message Type Test Results:');
        console.log('==================================');

        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;

        this.results.forEach(result => {
            const statusSymbol = result.status === 'PASS' ? '✓' : '✗';
            console.log(`${statusSymbol} ${result.name}: ${result.status}`);
            if (result.error) {
                console.log(`    Error: ${result.error}`);
            }
        });

        console.log('\nTotal:', this.results.length);
        console.log('Passed:', passed);
        console.log('Failed:', failed);
        console.log('Success Rate:', ((passed / this.results.length) * 100).toFixed(2) + '%');
    }

    // Test functions
    async testTextMessage() {
        const testMessage = 'Hello World';
        const startTime = Date.now();

        this.ws.send(testMessage);

        // Wait for response or timeout
        await this.waitForMessage(5000);

        assert.strictEqual(this.lastReceivedMessage.toString(), testMessage,
            `Expected "${testMessage}", got "${this.lastReceivedMessage}"`);

        console.log(`[DEBUG] Text message round-trip time: ${Date.now() - startTime}ms`);
    }

    async testJSONMessage() {
        const testMessage = {
            type: 'test',
            timestamp: Date.now(),
            data: {
                string: 'hello',
                number: 123,
                boolean: true,
                array: [1, 2, 3],
                nested: { key: 'value' }
            }
        };

        const startTime = Date.now();
        const jsonString = JSON.stringify(testMessage);

        this.ws.send(jsonString);

        // Wait for response
        await this.waitForMessage(5000);

        // Parse received message and compare
        const receivedObj = JSON.parse(this.lastReceivedMessage.toString());
        assert.deepStrictEqual(receivedObj, testMessage,
            'JSON objects do not match');

        console.log(`[DEBUG] JSON message round-trip time: ${Date.now() - startTime}ms`);
    }

    async testBinaryMessage() {
        // Create various binary message types
        const testCases = [
            {
                name: 'ArrayBuffer',
                data: new ArrayBuffer(16),
                validator: (received) => received instanceof Buffer
            },
            {
                name: 'TypedArray',
                data: new Uint8Array([1, 2, 3, 4, 5]),
                validator: (received) => {
                    const arr = new Uint8Array(received);
                    return arr.length === 5 && arr[0] === 1 && arr[4] === 5;
                }
            },
            {
                name: 'Buffer',
                data: Buffer.from('Hello Binary World', 'utf8'),
                validator: (received) => received.toString() === 'Hello Binary World'
            },
            {
                name: 'DataView',
                data: (() => {
                    const buffer = new ArrayBuffer(8);
                    const view = new DataView(buffer);
                    view.setUint32(0, 12345);
                    view.setUint32(4, 67890);
                    return buffer;
                })(),
                validator: (received) => {
                    const view = new DataView(received.buffer || received);
                    return view.getUint32(0) === 12345 && view.getUint32(4) === 67890;
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`[SUBTEST] Testing ${testCase.name}`);

            const startTime = Date.now();
            this.ws.send(testCase.data);

            await this.waitForMessage(5000);

            assert(testCase.validator(this.lastReceivedMessage),
                `${testCase.name} validation failed`);

            console.log(`[DEBUG] ${testCase.name} round-trip time: ${Date.now() - startTime}ms`);
        }
    }

    async testLargeMessage() {
        const sizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB

        for (const size of sizes) {
            const largeMessage = 'A'.repeat(size);
            const startTime = Date.now();

            console.log(`[SUBTEST] Testing ${size} bytes message`);

            this.ws.send(largeMessage);

            await this.waitForMessage(10000); // Longer timeout for large messages

            assert.strictEqual(this.lastReceivedMessage.toString(), largeMessage,
                `Large message (${size} bytes) does not match`);

            const roundTripTime = Date.now() - startTime;
            console.log(`[DEBUG] ${size} bytes round-trip time: ${roundTripTime}ms`);
        }
    }

    async testSpecialCharacters() {
        const testMessages = [
            'Hello 🌍 World',
            'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
            'Unicode: α β γ δ ε ζ η θ',
            'Emoji: 👋 👍 💖 🚀 ⭐',
            'Multiline:\nLine 1\nLine 2\nLine 3',
            'Tabs:\tColumn1\tColumn2\tColumn3',
            'Null byte: \0',
            'Control chars: \b\f\n\r\t\v'
        ];

        for (const message of testMessages) {
            console.log(`[SUBTEST] Testing special characters: ${message.substring(0, 50)}...`);

            const startTime = Date.now();
            this.ws.send(message);

            await this.waitForMessage(5000);

            assert.strictEqual(this.lastReceivedMessage.toString(), message,
                `Special character message does not match`);

            console.log(`[DEBUG] Special char round-trip time: ${Date.now() - startTime}ms`);
        }
    }

    async testMessageSequences() {
        const sequence = [
            'Message 1',
            JSON.stringify({ seq: 1, data: 'first' }),
            Buffer.from([0x01, 0x02, 0x03]),
            'Message 4',
            JSON.stringify({ seq: 2, data: 'last' })
        ];

        for (let i = 0; i < sequence.length; i++) {
            const message = sequence[i];
            console.log(`[SUBTEST] Sequence message ${i + 1}`);

            this.ws.send(message);
            await this.waitForMessage(5000);

            if (typeof message === 'string') {
                assert.strictEqual(this.lastReceivedMessage.toString(), message,
                    `Sequence message ${i + 1} does not match`);
            } else if (Buffer.isBuffer(message)) {
                assert(this.lastReceivedMessage.equals(message),
                    `Binary sequence message ${i + 1} does not match`);
            }
        }
    }

    async testConcurrentMessages() {
        const concurrentCount = 10;
        const promises = [];

        console.log(`[SUBTEST] Sending ${concurrentCount} concurrent messages`);

        for (let i = 0; i < concurrentCount; i++) {
            const message = `Concurrent message ${i}`;
            promises.push(
                new Promise((resolve, reject) => {
                    this.ws.send(message);

                    const timeout = setTimeout(() => {
                        reject(new Error(`Timeout waiting for message ${i}`));
                    }, 5000);

                    // Simple response tracking for concurrent test
                    setTimeout(() => {
                        clearTimeout(timeout);
                        resolve(message);
                    }, 100);
                })
            );
        }

        await Promise.all(promises);
        console.log(`[DEBUG] Successfully handled ${concurrentCount} concurrent messages`);
    }

    async waitForMessage(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (this.lastReceivedMessage) {
                    clearInterval(checkInterval);
                    resolve(this.lastReceivedMessage);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for message'));
                }
            }, 10);
        });
    }

    async runAllTests() {
        // Add all test cases
        this.addTest('Text Message Test', this.testTextMessage);
        this.addTest('JSON Message Test', this.testJSONMessage);
        this.addTest('Binary Message Test', this.testBinaryMessage);
        this.addTest('Large Message Test', this.testLargeMessage);
        this.addTest('Special Characters Test', this.testSpecialCharacters);
        this.addTest('Message Sequence Test', this.testMessageSequences);
        this.addTest('Concurrent Messages Test', this.testConcurrentMessages);

        await this.runTests();
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const wsUrl = args[0] || 'wss://localhost:8787/ws';

    console.log(`[INFO] Running message type tests against: ${wsUrl}\n`);

    const tester = new MessageTypeTests(wsUrl);
    tester.runAllTests().catch(console.error);
}

export default MessageTypeTests;