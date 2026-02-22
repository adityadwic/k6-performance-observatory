const slaConfig = require('../src/config/sla.json');
const { validateAgainstSLA } = require('../src/core/slaValidator');

describe('SLA Validator', () => {
    let mockK6Metrics;
    let mockInfraMetrics;
    let mockSlaConfig;

    beforeEach(() => {
        mockK6Metrics = {
            p50ResponseTime: 150,
            p90ResponseTime: 300,
            p95ResponseTime: 400,
            p99ResponseTime: 800,
            errorRate: 0.5,
            throughput: 50
        };

        mockInfraMetrics = {
            avgCpuUsage: '45.0',
            avgMemoryUsage: '60.0'
        };

        mockSlaConfig = {
            performance: {
                p50_response_time_ms: 200,
                p90_response_time_ms: 400,
                p95_response_time_ms: 500,
                p99_response_time_ms: 1000,
                max_error_rate_percent: 1,
                min_throughput_rps: 40
            },
            infrastructure: {
                max_cpu_usage_percent: 80,
                max_memory_usage_percent: 85
            },
            profiles: {}
        };
    });

    it('should pass all validations when metrics are within SLA', () => {
        const results = validateAgainstSLA(mockK6Metrics, mockInfraMetrics, 'default', mockSlaConfig);
        const allPassed = results.every(r => r.passed);
        expect(allPassed).toBe(true);
    });

    it('should fail when P95 response time exceeds threshold', () => {
        mockK6Metrics.p95ResponseTime = 600;
        const results = validateAgainstSLA(mockK6Metrics, mockInfraMetrics, 'default', mockSlaConfig);
        const p95Result = results.find(r => r.metric.includes('P95'));
        expect(p95Result.passed).toBe(false);
    });

    it('should fail when error rate exceeds threshold', () => {
        mockK6Metrics.errorRate = 2.0;
        const results = validateAgainstSLA(mockK6Metrics, mockInfraMetrics, 'default', mockSlaConfig);
        const errResult = results.find(r => r.metric.includes('Error Rate'));
        expect(errResult.passed).toBe(false);
    });
});
