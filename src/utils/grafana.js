const axios = require('axios');

const GRAFANA_URL = process.env.GRAFANA_URL;
const GRAFANA_TOKEN = process.env.GRAFANA_TOKEN;

/**
 * Create annotation in Grafana dashboard
 * @param {string} text - Annotation text
 * @param {string[]} tags - Array of tags
 * @param {object} options - Additional options
 */
async function createAnnotation(text, tags = ['load-test', 'performance'], options = {}) {
    if (!GRAFANA_URL || !GRAFANA_TOKEN) {
        console.log('[Grafana] ⚠️ Grafana credentials not configured, skipping annotation');
        return null;
    }

    try {
        const response = await axios.post(`${GRAFANA_URL}/api/annotations`, {
            time: options.startTime || Date.now(),
            timeEnd: options.endTime || undefined,
            text: text,
            tags: [...tags, options.profile || 'default'],
            dashboardUID: options.dashboardUID || undefined,
            panelId: options.panelId || undefined
        }, {
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`[Grafana] 🏷️ Annotation added: "${text}"`);
        return response.data.id;
    } catch (error) {
        console.error(`[Grafana] Failed to create annotation: ${error.message}`);
        return null;
    }
}

/**
 * Close/Update annotation with end time
 * @param {number} id - Annotation ID
 * @param {object} updateData - Data to update
 */
async function closeAnnotation(id, updateData = {}) {
    if (!GRAFANA_URL || !GRAFANA_TOKEN || !id) return;

    try {
        await axios.patch(`${GRAFANA_URL}/api/annotations/${id}`, {
            timeEnd: updateData.endTime || Date.now(),
            text: updateData.text || undefined,
            tags: updateData.tags || undefined
        }, {
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`[Grafana] 🏷️ Annotation closed: ID ${id}`);
    } catch (error) {
        console.error(`[Grafana] Failed to close annotation: ${error.message}`);
    }
}

/**
 * Get all annotations
 * @param {object} filters - Filter options
 */
async function getAnnotations(filters = {}) {
    if (!GRAFANA_URL || !GRAFANA_TOKEN) return [];

    try {
        const params = new URLSearchParams();
        if (filters.from) params.append('from', filters.from);
        if (filters.to) params.append('to', filters.to);
        if (filters.tags) filters.tags.forEach(tag => params.append('tags', tag));
        if (filters.limit) params.append('limit', filters.limit);

        const response = await axios.get(`${GRAFANA_URL}/api/annotations?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error(`[Grafana] Failed to get annotations: ${error.message}`);
        return [];
    }
}

/**
 * Create dashboard snapshot
 * @param {object} dashboard - Dashboard configuration
 */
async function createDashboardSnapshot(dashboard) {
    if (!GRAFANA_URL || !GRAFANA_TOKEN) return null;

    try {
        const response = await axios.post(`${GRAFANA_URL}/api/snapshots`, {
            dashboard: dashboard,
            expires: 86400 // 24 hours
        }, {
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log(`[Grafana] 📸 Dashboard snapshot created`);
        return response.data;
    } catch (error) {
        console.error(`[Grafana] Failed to create snapshot: ${error.message}`);
        return null;
    }
}

/**
 * Test Grafana connectivity
 */
async function testConnection() {
    if (!GRAFANA_URL || !GRAFANA_TOKEN) {
        return {
            connected: false,
            error: 'Grafana credentials not configured'
        };
    }

    try {
        const response = await axios.get(`${GRAFANA_URL}/api/health`, {
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`
            },
            timeout: 5000
        });

        return {
            connected: response.data?.database === 'ok',
            url: GRAFANA_URL,
            version: response.data?.version
        };
    } catch (error) {
        return {
            connected: false,
            error: error.message,
            url: GRAFANA_URL
        };
    }
}

/**
 * Create a performance test annotation with full context
 * @param {object} testContext - Full test context
 */
async function createTestAnnotation(testContext) {
    const { profile, targetUrl, status, duration, passedChecks, failedChecks } = testContext;

    const text = `
🚀 Performance Test ${status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
━━━━━━━━━━━━━━━━━━━━
Profile: ${profile?.toUpperCase() || 'DEFAULT'}
Target: ${targetUrl}
Duration: ${duration || 'N/A'}
Results: ${passedChecks}/${passedChecks + failedChecks} checks passed
${failedChecks > 0 ? `\n⚠️ ${failedChecks} SLA violation(s) detected` : ''}
    `.trim();

    return await createAnnotation(text, ['load-test', 'performance', profile || 'default', status]);
}

module.exports = {
    createAnnotation,
    closeAnnotation,
    getAnnotations,
    createDashboardSnapshot,
    testConnection,
    createTestAnnotation
};