const fs = require('fs');

// Mock fs before requiring reporter
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('[]'),
    writeFileSync: jest.fn()
}));

const { generateReport } = require('../src/utils/reporter');

describe('Reporter', () => {
    const mockValidationResults = [
        { metric: 'P50 Response Time (ms)', actual: '100.00', threshold: '<= 600', passed: true },
        { metric: 'P90 Response Time (ms)', actual: '300.00', threshold: '<= 1200', passed: true },
        { metric: 'P95 Response Time (ms)', actual: '450.00', threshold: '<= 1500', passed: true },
        { metric: 'P99 Response Time (ms)', actual: '900.00', threshold: '<= 2500', passed: true },
        { metric: 'Error Rate (%)', actual: '0.50', threshold: '<= 1', passed: true },
        { metric: 'Throughput (req/s)', actual: '5.00', threshold: '>= 2', passed: true }
    ];

    const mockMetadata = {
        profile: 'default',
        targetUrl: 'https://jsonplaceholder.typicode.com',
        duration: '30.00s',
        k6Metrics: {
            totalRequests: 150,
            iterations: 150,
            throughput: 5.0,
            endpoints: [
                { name: 'GET /posts (Browse/List)', avgDur: '120.55' },
                { name: 'API Dynamic endpoints (GET/POST)', avgDur: '250.33' }
            ],
            checksData: [
                { name: 'status is 200', passes: 100, fails: 0 },
                { name: 'response time < 3000ms', passes: 95, fails: 5 }
            ],
            p50ResponseTime: 100,
            p90ResponseTime: 300,
            p95ResponseTime: 450,
            p99ResponseTime: 900,
            avgResponseTime: 200,
            minResponseTime: 10,
            maxResponseTime: 1200,
            errorRate: 0.5
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('[]');
    });

    it('should generate all 3 report formats', () => {
        generateReport(mockValidationResults, mockMetadata);
        // writeFileSync called for: history.json, report.html, junit-report.xml, report.json = 4 times
        expect(fs.writeFileSync).toHaveBeenCalledTimes(4);
    });

    it('should write HTML report with correct content', () => {
        generateReport(mockValidationResults, mockMetadata);
        const htmlCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('report.html'));
        expect(htmlCall).toBeDefined();
        const htmlContent = htmlCall[1];
        expect(htmlContent).toContain('Performance & Observability Matrix');
        expect(htmlContent).toContain('SLA Validations Checklist');
    });

    it('should include endpoint breakdown in HTML when data is provided', () => {
        generateReport(mockValidationResults, mockMetadata);
        const htmlCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('report.html'));
        const htmlContent = htmlCall[1];
        expect(htmlContent).toContain('Endpoint Performance Details');
        expect(htmlContent).toContain('GET /posts (Browse/List)');
        expect(htmlContent).toContain('120.55');
    });

    it('should include checks breakdown in HTML when data is provided', () => {
        generateReport(mockValidationResults, mockMetadata);
        const htmlCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('report.html'));
        const htmlContent = htmlCall[1];
        expect(htmlContent).toContain('Detailed Scenario Execution Checks');
        expect(htmlContent).toContain('status is 200');
    });

    it('should write valid JUnit XML', () => {
        generateReport(mockValidationResults, mockMetadata);
        const xmlCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('junit-report.xml'));
        expect(xmlCall).toBeDefined();
        const xmlContent = xmlCall[1];
        expect(xmlContent).toContain('<?xml');
        expect(xmlContent).toContain('<testsuite');
        expect(xmlContent).toContain('SLA-Validation');
    });

    it('should write valid JSON report', () => {
        generateReport(mockValidationResults, mockMetadata);
        const jsonCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('report.json'));
        expect(jsonCall).toBeDefined();
        const parsed = JSON.parse(jsonCall[1]);
        expect(parsed.status).toBeDefined();
        expect(parsed.results).toHaveLength(6);
    });

    it('should update history.json with new run', () => {
        generateReport(mockValidationResults, mockMetadata);
        const historyCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('history.json'));
        expect(historyCall).toBeDefined();
        const history = JSON.parse(historyCall[1]);
        expect(history).toHaveLength(1);
        expect(history[0].profile).toBe('default');
    });

    it('should handle all failing results correctly', () => {
        const failResults = mockValidationResults.map(r => ({ ...r, passed: false }));
        generateReport(failResults, mockMetadata);
        const htmlCall = fs.writeFileSync.mock.calls.find(call => call[0].endsWith('report.html'));
        const htmlContent = htmlCall[1];
        expect(htmlContent).toContain('SLA Violations');
    });
});
