import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom Metrics
export let errorRate = new Rate('errors');
export let throughput = new Trend('throughput', true);
export let requestCounter = new Counter('total_requests');

// Response time trends per endpoint
export let browseDuration = new Trend('browse_duration', true);
export let apiDuration = new Trend('api_duration', true);

// Test profiles configuration
const profiles = {
    smoke: {
        stages: [{ duration: '1m', target: 5 }],
        thresholds: {
            http_req_duration: ['p(95)<300'],
            errors: ['rate<0.00'],
        }
    },
    default: {
        stages: [
            { duration: '5s', target: 10 },
            { duration: '15s', target: 10 },
            { duration: '10s', target: 0 },
        ],
        thresholds: {
            http_req_duration: ['p(95)<3000'],
            errors: ['rate<0.05'],
        }
    },
    stress: {
        stages: [
            { duration: '30s', target: 50 },
            { duration: '1m', target: 50 },
            { duration: '30s', target: 0 },
        ],
        thresholds: {
            http_req_duration: ['p(95)<1000'],
            errors: ['rate<0.02'],
        }
    },
    spike: {
        stages: [
            { duration: '10s', target: 200 },
            { duration: '30s', target: 200 },
            { duration: '10s', target: 0 },
        ],
        thresholds: {
            http_req_duration: ['p(95)<2000'],
            errors: ['rate<0.05'],
        }
    }
};

// Environment variables
const profileName = __ENV.PROFILE || 'default';
const selectedProfile = profiles[profileName] || profiles.default;
const BASE_URL = __ENV.TARGET_URL || 'https://jsonplaceholder.typicode.com';

// Export options for K6
export let options = {
    stages: selectedProfile.stages,
    thresholds: selectedProfile.thresholds,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)']
};

// Test scenarios
const scenarios = {
    // Browse posts
    browseCrocodiles: () => {
        const url = `${BASE_URL}/posts`;
        const res = http.get(url, { tags: { endpoint: 'browse', method: 'GET' } });

        browseDuration.add(res.timings.duration);
        requestCounter.add(1);

        let jsonBody = null;
        try { jsonBody = res.json(); } catch (_e) { /* not JSON */ }

        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 3000ms': (r) => r.timings.duration < 3000,
            'response is JSON array': () => Array.isArray(jsonBody),
            'response has valid schema': () => jsonBody && jsonBody.length > 0 && jsonBody[0].id !== undefined && jsonBody[0].title !== undefined,
        }, { endpoint: 'browse' });

        errorRate.add(!success, { endpoint: 'browse' });
        return { success, duration: res.timings.duration };
    },

    // Get single post detail
    getCrocodileDetail: () => {
        const id = Math.floor(Math.random() * 80) + 1;
        const url = `${BASE_URL}/posts/${id}`;
        const res = http.get(url, { tags: { endpoint: 'detail', method: 'GET' } });

        apiDuration.add(res.timings.duration);
        requestCounter.add(1);

        let jsonBody = null;
        try { jsonBody = res.json(); } catch (_e) { /* not JSON */ }

        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 3000ms': (r) => r.timings.duration < 3000,
            'detail has valid id': () => jsonBody && jsonBody.id !== undefined,
            'detail has valid body': () => jsonBody && jsonBody.body !== undefined,
        }, { endpoint: 'detail' });

        errorRate.add(!success, { endpoint: 'detail' });
        return { success, duration: res.timings.duration };
    },

    // Simulate Create Post (POST)
    userLoginProcess: () => {
        const url = `${BASE_URL}/posts`;
        const payload = JSON.stringify({
            title: `foo_${Math.floor(Math.random() * 1000)}`,
            body: 'bar',
            userId: 1
        });
        const params = {
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            tags: { endpoint: 'create_post', method: 'POST' }
        };

        const res = http.post(url, payload, params);

        apiDuration.add(res.timings.duration);
        requestCounter.add(1);

        let jsonBody = null;
        try { jsonBody = res.json(); } catch (_e) { /* not JSON */ }

        const success = check(res, {
            'create endpoint responding': (r) => r.status === 200 || r.status === 201,
            'create response time < 4000ms': (r) => r.timings.duration < 4000,
            'create returns id': () => jsonBody && jsonBody.id !== undefined,
        }, { endpoint: 'create_post' });

        errorRate.add(!success, { endpoint: 'create_post' });
        return { success, duration: res.timings.duration };
    },

    // Invalid Endpoint (Negative Testing)
    invalidEndpointNavigation: () => {
        const url = `${BASE_URL}/invalid_path_${Math.floor(Math.random() * 100)}`;
        const res = http.get(url, { tags: { endpoint: 'invalid_404', method: 'GET' } });

        requestCounter.add(1);

        const success = check(res, {
            'status is strictly 404': (r) => r.status === 404,
        }, { endpoint: 'invalid_404' });

        errorRate.add(!success, { endpoint: 'invalid_404' });
        return { success, duration: res.timings.duration };
    },

    // Health check
    healthCheck: () => {
        const res = http.get(`${BASE_URL}/`, { tags: { endpoint: 'health', method: 'GET' } });

        requestCounter.add(1);

        const success = check(res, {
            'status is 200': (r) => r.status === 200,
            'response time < 2000ms': (r) => r.timings.duration < 2000,
        }, { endpoint: 'health' });

        errorRate.add(!success, { endpoint: 'health' });
        return { success, duration: res.timings.duration };
    }
};

// Scenario distribution (weighted)
const scenarioWeights = {
    browse: 0.40,    // 40% listing
    detail: 0.30,   // 30% detail fetch
    login: 0.15,    // 15% authentication attempts
    invalid: 0.05,  // 5% negative tests
    health: 0.10    // 10% basic ping
};

function selectScenario() {
    const rand = Math.random();
    let cumulative = 0;

    for (const [name, weight] of Object.entries(scenarioWeights)) {
        cumulative += weight;
        if (rand <= cumulative) {
            return name;
        }
    }
    return 'browse';
}

// Main test function
export default function () {
    const scenario = selectScenario();

    let result;
    const startTime = Date.now();

    switch (scenario) {
        case 'browse':
            result = scenarios.browseCrocodiles();
            break;
        case 'detail':
            result = scenarios.getCrocodileDetail();
            break;
        case 'login':
            result = scenarios.userLoginProcess();
            break;
        case 'invalid':
            result = scenarios.invalidEndpointNavigation();
            break;
        case 'health':
            result = scenarios.healthCheck();
            break;
        default:
            result = scenarios.browseCrocodiles();
    }

    const totalTime = Date.now() - startTime;
    throughput.add(1000 / totalTime); // requests per second

    // Random think time for realistic simulation (1-3 seconds)
    sleep(Math.random() * 2 + 1);
}