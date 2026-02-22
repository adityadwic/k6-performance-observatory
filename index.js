require('dotenv').config();

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const { runK6LoadTest, extractK6Metrics } = require('./src/core/k6Runner');
const { validateAgainstSLA } = require('./src/core/slaValidator');

const { getSystemHealthSummary, testConnection: testPrometheusConnection } = require('./src/utils/prometheus');
const { generateReport } = require('./src/utils/reporter');
const { sendNotification } = require('./src/utils/notifier');
const { createAnnotation, closeAnnotation, testConnection: testGrafanaConnection } = require('./src/utils/grafana');
const slaConfig = require('./src/config/sla.json');

// Configuration
const TARGET_URL = process.env.TARGET_URL || 'https://jsonplaceholder.typicode.com';
const K6_SCRIPT_PATH = path.join(__dirname, 'src', 'tests', 'load_test.js');

const REPORTS_DIR = path.join(__dirname, 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const SUMMARY_JSON_PATH = path.join(REPORTS_DIR, 'k6-summary.json');
const RAW_JSON_PATH = path.join(REPORTS_DIR, 'k6-raw.json');

// Parse CLI Arguments
const args = minimist(process.argv.slice(2));
const runProfile = args.profile || args.p || 'default';
const skipK6 = args['skip-k6'] || false;
const dryRun = args['dry-run'] || false;

// Test run metadata
const testStartTime = Date.now();
let testMetadata = {
    profile: runProfile,
    targetUrl: TARGET_URL,
    startTime: new Date().toISOString(),
    duration: null
};

/**
 * Print banner
 */
function printBanner() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Advanced Performance & Observability Validation`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🎯 Target URL: ${TARGET_URL}`);
    console.log(`🎛️  Workload Profile: ${runProfile.toUpperCase()}`);
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
}

/**
 * Verify system requirements
 */
async function verifyPrerequisites() {
    console.log(`[0/6] 🔍 Verifying Prerequisites...`);

    // Check K6
    try {
        const k6Version = execSync('k6 version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(`      ✅ K6: ${k6Version.split('\n')[0]}`);
    } catch (e) {
        console.error(`      ❌ K6 not found. Please install K6 first.`);
        process.exit(1);
    }

    if (process.env.PROMETHEUS_URL) {
        const promStatus = await testPrometheusConnection();
        if (promStatus.connected) {
            console.log(`      ✅ Prometheus: Connected (${promStatus.url})`);
        } else {
            console.log(`      ⚠️  Prometheus: ${promStatus.error}`);
        }
    } else {
        console.log(`      ⏭️  Prometheus: Not configured`);
    }

    if (process.env.GRAFANA_URL && process.env.GRAFANA_TOKEN) {
        const grafanaStatus = await testGrafanaConnection();
        if (grafanaStatus.connected) {
            console.log(`      ✅ Grafana: Connected (${grafanaStatus.url})`);
        } else {
            console.log(`      ⚠️  Grafana: ${grafanaStatus.error}`);
        }
    } else {
        console.log(`      ⏭️  Grafana: Not configured`);
    }

    if (process.env.WEBHOOK_URL) {
        console.log(`      ✅ Webhook: Configured`);
    } else {
        console.log(`      ⏭️  Webhook: Not configured`);
    }
    console.log(``);
}

/**
 * Query Observability (Prometheus)
 */
async function queryObservability() {
    console.log(`\n[3/6] 📡 Querying System Health from Prometheus API...`);

    const infrastructureMetrics = {
        avgCpuUsage: 'N/A',
        avgMemoryUsage: 'N/A',
        maxCpuUsage: 'N/A',
        maxMemoryUsage: 'N/A',
        diskIO: 'N/A',
        networkIn: 'N/A',
        networkOut: 'N/A'
    };

    if (!process.env.PROMETHEUS_URL) {
        console.log(`      ⏭️  Skipping Prometheus (PROMETHEUS_URL not set)`);
        return infrastructureMetrics;
    }

    try {
        const systemHealth = await getSystemHealthSummary(testMetadata.startTime, new Date().toISOString());

        if (systemHealth.summary.avgCpu) infrastructureMetrics.avgCpuUsage = systemHealth.summary.avgCpu;
        if (systemHealth.summary.maxCpu) infrastructureMetrics.maxCpuUsage = systemHealth.summary.maxCpu;
        if (systemHealth.summary.avgMemory) infrastructureMetrics.avgMemoryUsage = systemHealth.summary.avgMemory;
        if (systemHealth.summary.maxMemory) infrastructureMetrics.maxMemoryUsage = systemHealth.summary.maxMemory;

        if (systemHealth.instant.diskIO?.value) infrastructureMetrics.diskIO = systemHealth.instant.diskIO.value.toFixed(2);
        if (systemHealth.instant.networkIn?.value) infrastructureMetrics.networkIn = (systemHealth.instant.networkIn.value / 1024).toFixed(2);
        if (systemHealth.instant.networkOut?.value) infrastructureMetrics.networkOut = (systemHealth.instant.networkOut.value / 1024).toFixed(2);

        console.log(`      -> Avg CPU Usage: ${infrastructureMetrics.avgCpuUsage}%`);
        console.log(`      -> Max CPU Usage: ${infrastructureMetrics.maxCpuUsage}%`);
        console.log(`      -> Avg Memory Usage: ${infrastructureMetrics.avgMemoryUsage}%`);
        console.log(`      -> Max Memory Usage: ${infrastructureMetrics.maxMemoryUsage}%`);

        if (infrastructureMetrics.diskIO !== 'N/A') console.log(`      -> Disk I/O: ${infrastructureMetrics.diskIO}%`);
        if (infrastructureMetrics.networkIn !== 'N/A') console.log(`      -> Network In: ${infrastructureMetrics.networkIn} KB/s`);
        if (infrastructureMetrics.networkOut !== 'N/A') console.log(`      -> Network Out: ${infrastructureMetrics.networkOut} KB/s`);

    } catch (e) {
        console.log(`      ⚠️  Could not fetch Prometheus metrics: ${e.message}`);
    }

    return infrastructureMetrics;
}

/**
 * Generate artifacts and notifications
 */
async function generateArtifacts(validationResults, k6Metrics, infraMetrics) {
    console.log(`\n[5/6] 📄 Generating Artifacts and Notifications...`);
    testMetadata.duration = ((Date.now() - testStartTime) / 1000).toFixed(2) + 's';

    const reportMetadata = {
        ...testMetadata,
        k6Metrics: {
            totalRequests: k6Metrics.totalRequests,
            iterations: k6Metrics.iterations,
            throughput: k6Metrics.throughput,
            endpoints: k6Metrics.endpoints || [],
            checksData: k6Metrics.checksData || [],
            p50ResponseTime: k6Metrics.p50ResponseTime,
            p90ResponseTime: k6Metrics.p90ResponseTime,
            p95ResponseTime: k6Metrics.p95ResponseTime,
            p99ResponseTime: k6Metrics.p99ResponseTime,
            avgResponseTime: k6Metrics.avgResponseTime,
            minResponseTime: k6Metrics.minResponseTime,
            maxResponseTime: k6Metrics.maxResponseTime,
            errorRate: k6Metrics.errorRate
        },
        slaConfig: slaConfig
    };

    generateReport(validationResults, reportMetadata);

    const notificationMetadata = {
        profile: runProfile,
        targetUrl: TARGET_URL,
        duration: testMetadata.duration,
        slaConfig: slaConfig
    };

    await sendNotification(validationResults, 'https://ci-artifact-url/reports/report.html', notificationMetadata);
}

/**
 * Update Grafana annotation with results
 */
async function updateGrafanaAnnotation(annotationId, validationResults) {
    console.log(`\n[6/6] 🏁 Finalizing Test Run...`);

    const passed = validationResults.filter(r => r.passed).length;
    const failed = validationResults.filter(r => !r.passed).length;
    const status = failed === 0 ? 'passed' : 'failed';

    if (annotationId) {
        await closeAnnotation(annotationId, {
            text: `Test ${status.toUpperCase()}: ${passed}/${passed + failed} checks passed`
        });
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎉 Process completed for profile: ${runProfile}`);
    console.log(`⏱️  Total Duration: ${testMetadata.duration}`);
    console.log(`📊 Results: ${passed}/${validationResults.length} checks passed`);
    console.log(`${'═'.repeat(60)}\n`);

    return status;
}

/**
 * Main execution function
 */
async function runPerformanceValidation() {
    printBanner();
    await verifyPrerequisites();

    const annotationText = `Load Test Started: Profile - ${runProfile}`;
    const annotationId = await createAnnotation(annotationText, ['load-test', 'performance', runProfile]);

    // Step 1: Run K6
    const k6Ran = await runK6LoadTest(K6_SCRIPT_PATH, runProfile, TARGET_URL, SUMMARY_JSON_PATH, RAW_JSON_PATH, skipK6, dryRun);

    if (!k6Ran && !dryRun) {
        console.error(`\n❌ [Error] K6 execution completely failed.`);
        if (annotationId) await closeAnnotation(annotationId);
        process.exit(1);
    }

    if (dryRun) process.exit(0);

    if (!fs.existsSync(SUMMARY_JSON_PATH)) {
        console.error(`\n❌ [Error] Summary JSON not found. Stop.`);
        if (annotationId) await closeAnnotation(annotationId);
        process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(SUMMARY_JSON_PATH, 'utf-8'));
    const k6Metrics = extractK6Metrics(summary);
    const infraMetrics = await queryObservability();
    const validationResults = validateAgainstSLA(k6Metrics, infraMetrics, runProfile, slaConfig);

    await generateArtifacts(validationResults, k6Metrics, infraMetrics);

    await updateGrafanaAnnotation(annotationId, validationResults);

    const failedSlos = validationResults.filter(r => !r.passed);
    if (failedSlos.length > 0) {
        console.log(`\n🚨 SLA Violation Detected. Exiting with Error Code 1.\n`);
        process.exit(1);
    }

    process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(`\n❌ Uncaught Exception: ${error.message}`);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error(`\n❌ Unhandled Rejection: ${reason}`);
    process.exit(1);
});

// Run
runPerformanceValidation();