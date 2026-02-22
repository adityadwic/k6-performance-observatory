const { extractK6Metrics } = require('../src/core/k6Runner');

describe('K6 Metrics Extractor', () => {
    let mockSummary;

    beforeEach(() => {
        mockSummary = {
            metrics: {
                http_req_duration: {
                    med: 150,
                    'p(90)': 300,
                    'p(95)': 450,
                    'p(99)': 900,
                    avg: 200,
                    min: 10,
                    max: 1200
                },
                errors: {
                    value: 0.02,
                    passes: 2,
                    fails: 98
                },
                http_reqs: {
                    count: 100,
                    rate: 5.5
                },
                iterations: {
                    count: 100
                },
                browse_duration: {
                    avg: 120.55,
                    min: 10,
                    max: 500
                },
                api_duration: {
                    avg: 250.33,
                    min: 15,
                    max: 800
                }
            },
            root_group: {
                checks: {
                    'status is 200': {
                        name: 'status is 200',
                        passes: 95,
                        fails: 5
                    },
                    'response time < 3000ms': {
                        name: 'response time < 3000ms',
                        passes: 90,
                        fails: 10
                    }
                }
            }
        };
    });

    it('should extract response time percentiles correctly', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.p50ResponseTime).toBe(150);
        expect(metrics.p90ResponseTime).toBe(300);
        expect(metrics.p95ResponseTime).toBe(450);
        expect(metrics.p99ResponseTime).toBe(900);
        expect(metrics.avgResponseTime).toBe(200);
        expect(metrics.minResponseTime).toBe(10);
        expect(metrics.maxResponseTime).toBe(1200);
    });

    it('should calculate error rate from errors metric', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.errorRate).toBe(2); // 0.02 * 100
    });

    it('should fallback to http_req_failed when errors metric is missing', () => {
        delete mockSummary.metrics.errors;
        mockSummary.metrics.http_req_failed = { value: 0.05 };
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.errorRate).toBe(5); // 0.05 * 100
    });

    it('should extract throughput and total requests', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.throughput).toBe(5.5);
        expect(metrics.totalRequests).toBe(100);
    });

    it('should extract iteration count', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.iterations).toBe(100);
    });

    it('should extract checksData from object-format checks', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.checksData).toHaveLength(2);
        expect(metrics.checksData[0].name).toBe('status is 200');
        expect(metrics.checksData[0].passes).toBe(95);
        expect(metrics.checksData[0].fails).toBe(5);
    });

    it('should extract checksData from array-format checks', () => {
        mockSummary.root_group.checks = [
            { name: 'check1', passes: 50, fails: 0 },
            { name: 'check2', passes: 48, fails: 2 }
        ];
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.checksData).toHaveLength(2);
        expect(metrics.checksData[1].fails).toBe(2);
    });

    it('should handle missing root_group gracefully', () => {
        delete mockSummary.root_group;
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.checksData).toEqual([]);
    });

    it('should extract custom endpoint metrics', () => {
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.endpoints).toHaveLength(2);
        expect(metrics.endpoints[0].name).toBe('GET /posts (Browse/List)');
        expect(metrics.endpoints[0].avgDur).toBe('120.55');
    });

    it('should handle missing duration metrics gracefully', () => {
        mockSummary.metrics.http_req_duration = {};
        const metrics = extractK6Metrics(mockSummary);
        expect(metrics.p50ResponseTime).toBe(0);
        expect(metrics.p95ResponseTime).toBe(0);
    });
});
