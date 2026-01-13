const { performance } = require('perf_hooks');

class PerformanceTester {
    constructor(options = {}) {
        this.options = {
            warmupRounds: options.warmupRounds || 5,
            testRounds: options.testRounds || 100,
            messageSizes: options.messageSizes || [64, 256, 1024, 4096],
            concurrencyLevels: options.concurrencyLevels || [1, 5, 10, 20],
            interval: options.interval || 10, // ms between messages
            timeout: options.timeout || 30000, // 30 second timeout per test
            ...options
        };

        this.results = {
            latency: [],
            throughput: [],
            memory: [],
            errorRate: [],
            connectionStability: []
        };

        this.stats = {
            totalMessages: 0,
            successfulMessages: 0,
            failedMessages: 0,
            totalBytes: 0,
            startTime: null,
            endTime: null
        };
    }

    async runCompleteTest(clientFactory) {
        console.log('[PERFORMANCE] Starting comprehensive performance test...\n');

        const allResults = {
            latency: {},
            throughput: {},
            memory: {},
            errorRate: {},
            connectionStability: {}
        };

        // Test different message sizes
        for (const size of this.options.messageSizes) {
            console.log(`[PERFORMANCE] Testing message size: ${size} bytes`);
            const result = await this.testMessageSize(clientFactory, size);
            allResults.latency[size] = result.latency;
            allResults.throughput[size] = result.throughput;
            allResults.errorRate[size] = result.errorRate;
        }

        // Test different concurrency levels
        for (const concurrency of this.options.concurrencyLevels) {
            console.log(`[PERFORMANCE] Testing concurrency: ${concurrency} connections`);
            const result = await this.testConcurrency(clientFactory, concurrency);
            allResults.throughput[`${concurrency}_concurrent`] = result.throughput;
            allResults.errorRate[`${concurrency}_concurrent`] = result.errorRate;
        }

        // Stress test
        console.log('[PERFORMANCE] Running stress test');
        const stressResult = await this.runStressTest(clientFactory);
        allResults.stress = stressResult;

        this.printDetailedReport(allResults);
        return allResults;
    }

    async testMessageSize(clientFactory, messageSize) {
        const client = await clientFactory();
        await this.warmup(client, messageSize);

        const messages = this.generateTestMessages(messageSize, this.options.testRounds);
        const results = await this.measureRoundTripTime(client, messages);

        client.disconnect();
        return results;
    }

    async testConcurrency(clientFactory, concurrencyLevel) {
        const clients = [];
        const results = {
            latency: [],
            throughput: [],
            errorRate: 0
        };

        // Create multiple clients
        for (let i = 0; i < concurrencyLevel; i++) {
            const client = await clientFactory();
            clients.push(client);
        }

        // Warm up
        for (const client of clients) {
            await this.warmup(client, 1024, 5);
        }

        // Concurrent test
        const startTime = performance.now();
        const promises = [];

        for (let round = 0; round < this.options.testRounds; round++) {
            const clientIndex = round % clients.length;
            const client = clients[clientIndex];

            promises.push(
                this.sendMessageWithTiming(client, `concurrent_test_${round}`)
                    .catch(err => ({ error: err.message }))
            );

            if (round % 10 === 0) { // Throttle to prevent overwhelming
                await Promise.all(promises.splice(0, 10));
            }
        }

        const allResults = await Promise.all(promises);
        const endTime = performance.now();

        // Calculate results
        const successful = allResults.filter(r => !r.error);
        const failed = allResults.filter(r => r.error);

        results.errorRate = failed.length / allResults.length;
        results.throughput = (allResults.length / ((endTime - startTime) / 1000)).toFixed(2);

        clients.forEach(client => client.disconnect());

        return results;
    }

    async warmup(client, messageSize, rounds = null) {
        const warmupRounds = rounds || this.options.warmupRounds;
        const warmupMessages = this.generateTestMessages(messageSize, warmupRounds);

        for (const message of warmupMessages) {
            try {
                await client.send(message);
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
            } catch (error) {
                console.warn(`[WARMUP] Warning: ${error.message}`);
            }
        }
    }

    generateTestMessages(size, count) {
        const messages = [];
        for (let i = 0; i < count; i++) {
            const message = {
                id: `msg_${Date.now()}_${i}`,
                timestamp: Date.now(),
                data: 'A'.repeat(size - 50), // Account for metadata
                type: 'performance_test'
            };
            messages.push(JSON.stringify(message));
        }
        return messages;
    }

    async measureRoundTripTime(client, messages) {
        const results = {
            latency: [],
            throughput: [],
            errorRate: 0,
            startTime: performance.now()
        };

        let successful = 0;
        let failed = 0;

        for (const message of messages) {
            try {
                const startTime = performance.now();
                await client.send(message);
                const endTime = performance.now();

                results.latency.push(endTime - startTime);
                successful++;

                if (this.options.interval > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.options.interval));
                }
            } catch (error) {
                failed++;
                console.error(`[PERFORMANCE] Send failed: ${error.message}`);
            }
        }

        results.errorRate = failed / (successful + failed);
        const totalTime = performance.now() - results.startTime;
        results.throughput = ((successful + failed) / (totalTime / 1000)).toFixed(2);

        // Calculate statistics
        if (results.latency.length > 0) {
            results.avgLatency = results.latency.reduce((a, b) => a + b, 0) / results.latency.length;
            results.minLatency = Math.min(...results.latency);
            results.maxLatency = Math.max(...results.latency);

            // Calculate median
            const sorted = [...results.latency].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            results.medianLatency = sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
        }

        return results;
    }

    async sendMessageWithTiming(client, message) {
        const startTime = performance.now();
        const result = {
            startTime,
            message,
            success: false,
            error: null,
            roundTripTime: 0
        };

        try {
            await client.send(message);
            const endTime = performance.now();
            result.success = true;
            result.roundTripTime = endTime - startTime;
        } catch (error) {
            result.error = error.message;
        }

        return result;
    }

    async runStressTest(clientFactory) {
        const client = await clientFactory();
        const results = {
            peakThroughput: 0,
            sustainedThroughput: 0,
            connectionStability: 1.0,
            memoryUsage: [],
            gcPressure: 0
        };

        // Record initial state
        const initialMemory = process.memoryUsage();
        const startTime = performance.now();

        try {
            // High-intensity burst
            const burstPromises = [];
            for (let i = 0; i < 100; i++) {
                burstPromises.push(
                    this.sendMessageWithTiming(client, `stress_burst_${i}`)
                );
            }

            const burstResults = await Promise.all(burstPromises);
            const burstSuccessful = burstResults.filter(r => r.success).length;
            const burstDuration = performance.now() - startTime;
            results.peakThroughput = (burstSuccessful / (burstDuration / 1000)).toFixed(2);

            // Sustained load
            const sustainedStartTime = performance.now();
            let sustainedCount = 0;

            while (performance.now() - sustainedStartTime < 10000) { // 10 seconds
                try {
                    await client.send(`stress_sustained_${sustainedCount}`);
                    sustainedCount++;
                    await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
                } catch (error) {
                    console.error(`[STRESS] Sustained test error: ${error.message}`);
                    break;
                }
            }

            const sustainedDuration = performance.now() - sustainedStartTime;
            results.sustainedThroughput = (sustainedCount / (sustainedDuration / 1000)).toFixed(2);

            // Monitor memory usage
            const finalMemory = process.memoryUsage();
            results.memoryUsage = {
                initial: initialMemory,
                final: finalMemory,
                difference: {
                    rss: finalMemory.rss - initialMemory.rss,
                    heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                    heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
                }
            };

        } catch (error) {
            console.error(`[STRESS] Test error: ${error.message}`);
        } finally {
            client.disconnect();
        }

        return results;
    }

    async runLoadTest(clientFactory, durationSeconds = 60) {
        const client = await clientFactory();
        const results = {
            throughputOverTime: [],
            latencyOverTime: [],
            errorRateOverTime: [],
            connectionDrops: 0,
            totalMessages: 0,
            successfulMessages: 0
        };

        const startTime = performance.now();
        const interval = 1000; // Sample every second
        let lastSampleTime = startTime;

        try {
            while (performance.now() - startTime < durationSeconds * 1000) {
                const sampleStartTime = performance.now();
                let sampleSuccesses = 0;
                let sampleFailures = 0;
                let sampleLatencies = [];

                // Send messages for 1 second
                while (performance.now() - sampleStartTime < interval) {
                    try {
                        const msgTime = performance.now();
                        await client.send(`load_test_${results.totalMessages}`);
                        const msgLatency = performance.now() - msgTime;

                        sampleLatencies.push(msgLatency);
                        sampleSuccesses++;
                        results.successfulMessages++;
                    } catch (error) {
                        sampleFailures++;
                        if (error.message.includes('connection')) {
                            results.connectionDrops++;
                        }
                    }

                    results.totalMessages++;

                    // Small delay to prevent overwhelming
                    await new Promise(resolve => setTimeout(resolve, 1));
                }

                // Record sample
                const sampleThroughput = (sampleSuccesses / (interval / 1000)).toFixed(2);
                const sampleAvgLatency = sampleLatencies.length > 0
                    ? sampleLatencies.reduce((a, b) => a + b, 0) / sampleLatencies.length
                    : 0;
                const sampleErrorRate = (sampleFailures / (sampleSuccesses + sampleFailures)) || 0;

                results.throughputOverTime.push(parseFloat(sampleThroughput));
                results.latencyOverTime.push(sampleAvgLatency);
                results.errorRateOverTime.push(sampleErrorRate);

                lastSampleTime = performance.now();
            }
        } finally {
            client.disconnect();
        }

        return results;
    }

    printDetailedReport(results) {
        console.log('\n[PERFORMANCE] DETAILED TEST RESULTS');
        console.log('==================================');

        // Latency report
        console.log('\n📊 LATENCY ANALYSIS');
        for (const [size, latencyData] of Object.entries(results.latency)) {
            if (latencyData.avgLatency) {
                console.log(`Message Size ${size} bytes:`);
                console.log(`  Average: ${latencyData.avgLatency.toFixed(2)}ms`);
                console.log(`  Median: ${latencyData.medianLatency.toFixed(2)}ms`);
                console.log(`  Min: ${latencyData.minLatency.toFixed(2)}ms`);
                console.log(`  Max: ${latencyData.maxLatency.toFixed(2)}ms`);
                console.log(`  Throughput: ${latencyData.throughput} msg/s`);
                console.log(`  Error Rate: ${(latencyData.errorRate * 100).toFixed(2)}%`);
            }
        }

        // Concurrency report
        console.log('\n⚡ CONCURRENCY ANALYSIS');
        for (const [concurrency, data] of Object.entries(results.throughput)) {
            if (concurrency.includes('_concurrent')) {
                console.log(`Concurrency Level ${concurrency.replace('_concurrent', '')}:`);
                console.log(`  Throughput: ${data} msg/s`);
                console.log(`  Error Rate: ${(results.errorRate[concurrency] * 100).toFixed(2)}%`);
            }
        }

        // Stress test report
        if (results.stress) {
            console.log('\n🔥 STRESS TEST RESULTS');
            console.log(`Peak Throughput: ${results.stress.peakThroughput} msg/s`);
            console.log(`Sustained Throughput: ${results.stress.sustainedThroughput} msg/s`);

            if (results.stress.memoryUsage) {
                console.log('Memory Usage Changes:');
                console.log(`  RSS: ${this.formatBytes(results.stress.memoryUsage.difference.rss)}`);
                console.log(`  Heap Used: ${this.formatBytes(results.stress.memoryUsage.difference.heapUsed)}`);
            }
        }

        // Summary
        console.log('\n📈 SUMMARY');
        const allThroughputs = Object.values(results.throughput)
            .filter(v => typeof v === 'string' || typeof v === 'number');
        if (allThroughputs.length > 0) {
            const maxThroughput = Math.max(...allThroughputs.map(Number));
            console.log(`Maximum Achieved Throughput: ${maxThroughput} msg/s`);
        }

        const allErrorRates = Object.values(results.errorRate)
            .filter(v => typeof v === 'number');
        if (allErrorRates.length > 0) {
            const avgErrorRate = allErrorRates.reduce((a, b) => a + b, 0) / allErrorRates.length;
            console.log(`Average Error Rate: ${(avgErrorRate * 100).toFixed(2)}%`);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Utility methods for specific tests
    async testBandwidth(clientFactory, durationMs = 10000) {
        const client = await clientFactory();
        const results = { sentBytes: 0, receivedBytes: 0, throughput: 0 };

        const startTime = performance.now();
        const messageSize = 1024; // 1KB messages
        const message = 'A'.repeat(messageSize);

        while (performance.now() - startTime < durationMs) {
            try {
                await client.send(message);
                results.sentBytes += messageSize;

                // Simulate receiving response (in real scenario, you'd wait for actual response)
                results.receivedBytes += messageSize;
            } catch (error) {
                break;
            }
        }

        const durationSec = (performance.now() - startTime) / 1000;
        results.throughput = (results.sentBytes / durationSec) * 8; // bits per second

        client.disconnect();
        return results;
    }

    async testConnectionLimits(clientFactory, maxConnections = 100) {
        const clients = [];
        const results = { successfulConnections: 0, failedConnections: 0, connectionTimes: [] };

        for (let i = 0; i < maxConnections; i++) {
            try {
                const startTime = performance.now();
                const client = await clientFactory();
                const connectTime = performance.now() - startTime;

                results.successfulConnections++;
                results.connectionTimes.push(connectTime);
                clients.push(client);

                console.log(`[CONNECTION] Connection ${i + 1}/${maxConnections} successful (${connectTime.toFixed(2)}ms)`);
            } catch (error) {
                results.failedConnections++;
                console.error(`[CONNECTION] Connection ${i + 1} failed: ${error.message}`);

                if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
                    break; // Stop if server is refusing connections
                }
            }
        }

        // Clean up connections
        for (const client of clients) {
            client.disconnect();
        }

        results.avgConnectionTime = results.connectionTimes.length > 0
            ? results.connectionTimes.reduce((a, b) => a + b, 0) / results.connectionTimes.length
            : 0;

        return results;
    }
}

module.exports = PerformanceTester;

// CLI interface
if (require.main === module) {
    console.log('PerformanceTester utility loaded. Use as a module in your test scripts.');

    // Example usage would be:
    /*
    const PerformanceTester = require('./performance-tester');
    const tester = new PerformanceTester({
        messageSizes: [64, 256, 1024],
        testRounds: 50
    });
    
    tester.runCompleteTest(async () => {
        // Return configured client instance
        const client = new WebSocketClient({ url: 'wss://...' });
        await client.connect();
        return client;
    }).then(results => {
        console.log('Performance test completed:', results);
    });
    */
}