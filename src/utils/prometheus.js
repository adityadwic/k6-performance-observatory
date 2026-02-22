const axios = require('axios');

const PROM_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';
const MAX_RETRIES = parseInt(process.env.PROM_RETRIES) || 3;
const RETRY_DELAY = parseInt(process.env.PROM_RETRY_DELAY) || 1000;

// Default metric queries with configurable options
const DEFAULT_QUERIES = {
    cpu: process.env.CPU_QUERY || '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)',
    memory: process.env.MEM_QUERY || '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    networkIn: 'rate(node_network_receive_bytes_total[1m])',
    networkOut: 'rate(node_network_transmit_bytes_total[1m])',
    diskIO: 'rate(node_disk_io_time_seconds_total[1m])',
    loadAverage: 'node_load1',
    connections: 'node_netstat_Tcp_CurrEstab',
};

// Sleep utility for retry
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch a query from Prometheus with retry logic
 * @param {string} query The promQL query
 * @param {string} start Start time (ISO or unix)
 * @param {string} end End time (ISO or unix)
 * @param {string} step Step duration, e.g., '15s'
 * @param {number} maxRetries Maximum retry attempts
 */
async function queryPrometheusRange(query, start, end, step = '15s', maxRetries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(`${PROM_URL}/api/v1/query_range`, {
                params: { query, start, end, step },
                timeout: 10000
            });

            if (response.data && response.data.status === 'success') {
                return {
                    success: true,
                    data: response.data.data.result,
                    query: query
                };
            }

            lastError = new Error('Prometheus response not successful');
        } catch (error) {
            lastError = error;
            console.error(`[Prometheus] Attempt ${attempt}/${maxRetries} failed for query: ${query.substring(0, 50)}...`);

            if (attempt < maxRetries) {
                const delay = RETRY_DELAY * attempt;
                console.log(`[Prometheus] Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    console.error(`[Prometheus API Error] All retries exhausted for: ${query.substring(0, 50)}...`);
    return { success: false, error: lastError?.message, data: [] };
}

/**
 * Fetch instant vector or simple scalar
 * @param {string} query The promQL query
 * @param {number} maxRetries Maximum retry attempts
 */
async function queryPrometheusInstant(query, maxRetries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.get(`${PROM_URL}/api/v1/query`, {
                params: { query },
                timeout: 10000
            });

            if (response.data && response.data.status === 'success') {
                return response.data.data.result;
            }

            lastError = new Error('Prometheus response not successful');
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                await sleep(RETRY_DELAY * attempt);
            }
        }
    }

    console.error(`[Prometheus API Error] Failed querying: ${query.substring(0, 50)}...`);
    return [];
}

/**
 * Fetch multiple metrics at once
 * @param {string[]} metricNames Array of metric names to fetch
 * @param {object} customQueries Custom queries to override defaults
 */
async function fetchMultipleMetrics(metricNames = ['cpu', 'memory'], customQueries = {}) {
    const queries = { ...DEFAULT_QUERIES, ...customQueries };
    const results = {};

    for (const metricName of metricNames) {
        if (!queries[metricName]) {
            console.warn(`[Prometheus] Unknown metric: ${metricName}`);
            continue;
        }

        try {
            const result = await queryPrometheusInstant(queries[metricName]);

            if (result && result.length > 0) {
                // Extract value from Prometheus response format
                results[metricName] = {
                    value: parseFloat(result[0].value[1]),
                    instance: result[0].metric?.instance || 'unknown',
                    timestamp: new Date(result[0].value[0] * 1000).toISOString()
                };
            } else {
                results[metricName] = { value: null, error: 'No data returned' };
            }
        } catch (error) {
            results[metricName] = { value: null, error: error.message };
        }
    }

    return results;
}

/**
 * Get system health summary
 * @param {string} startTime Test start time
 * @param {string} endTime Test end time
 */
async function getSystemHealthSummary(startTime, endTime) {
    const metrics = await fetchMultipleMetrics([
        'cpu', 'memory', 'networkIn', 'networkOut', 'diskIO', 'loadAverage'
    ]);

    // Get range data for CPU and Memory during test
    let cpuRange = [];
    let memoryRange = [];

    if (startTime && endTime) {
        const cpuRangeResult = await queryPrometheusRange(
            DEFAULT_QUERIES.cpu, startTime, endTime, '15s'
        );
        const memRangeResult = await queryPrometheusRange(
            DEFAULT_QUERIES.memory, startTime, endTime, '15s'
        );

        if (cpuRangeResult.success) {
            cpuRange = cpuRangeResult.data;
        }
        if (memRangeResult.success) {
            memoryRange = memRangeResult.data;
        }
    }

    return {
        instant: metrics,
        range: {
            cpu: cpuRange,
            memory: memoryRange
        },
        summary: {
            avgCpu: calculateAverage(cpuRange),
            maxCpu: calculateMax(cpuRange),
            avgMemory: calculateAverage(memoryRange),
            maxMemory: calculateMax(memoryRange)
        }
    };
}

/**
 * Calculate average from Prometheus range data
 */
function calculateAverage(rangeData) {
    if (!rangeData || rangeData.length === 0) return null;

    const values = rangeData[0]?.values || [];
    if (values.length === 0) return null;

    const sum = values.reduce((acc, v) => acc + parseFloat(v[1]), 0);
    return (sum / values.length).toFixed(2);
}

/**
 * Calculate max from Prometheus range data
 */
function calculateMax(rangeData) {
    if (!rangeData || rangeData.length === 0) return null;

    const values = rangeData[0]?.values || [];
    if (values.length === 0) return null;

    const max = Math.max(...values.map(v => parseFloat(v[1])));
    return max.toFixed(2);
}

/**
 * Test Prometheus connectivity
 */
async function testConnection() {
    try {
        const response = await axios.get(`${PROM_URL}/api/v1/query`, {
            params: { query: 'up' },
            timeout: 5000
        });

        return {
            connected: response.data?.status === 'success',
            url: PROM_URL
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message,
            url: PROM_URL
        };
    }
}

module.exports = {
    queryPrometheusRange,
    queryPrometheusInstant,
    fetchMultipleMetrics,
    getSystemHealthSummary,
    testConnection,
    DEFAULT_QUERIES
};