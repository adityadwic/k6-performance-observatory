const { spawn } = require('child_process');
const fs = require('fs');

async function runK6LoadTest(scriptPath, profile, targetUrl, summaryPath, rawJsonPath, skipK6, dryRun) {
    console.log(`[1/6] 🏎️  Running K6 Load Test (${profile} profile)...`);

    if (dryRun) {
        console.log(`      ⏭️  Dry run mode - skipping K6 execution`);
        return true;
    }

    if (skipK6) {
        console.log(`      ⏭️  Skipping K6 (using existing results)`);
        return fs.existsSync(summaryPath);
    }

    return new Promise((resolve) => {
        const k6Process = spawn('k6', [
            'run',
            `--out`, `json=${rawJsonPath}`,
            `--summary-export=${summaryPath}`,
            '-e', `TARGET_URL=${targetUrl}`,
            '-e', `PROFILE=${profile}`,
            scriptPath
        ], { stdio: 'inherit' });

        k6Process.on('close', (code) => {
            if (code === 0 || code === 99) { // 99 means thresholds crossed
                if (code === 99) {
                    console.warn(`      ⚠️  K6 execution finished with SLA threshold crossed, continuing validation...`);
                }
                resolve(fs.existsSync(summaryPath));
            } else {
                console.error(`      ❌ K6 process exited with code ${code}`);
                resolve(false);
            }
        });

        k6Process.on('error', (err) => {
            console.error(`      ❌ Failed to start K6 process: ${err.message}`);
            resolve(false);
        });
    });
}

function extractK6Metrics(summary) {
    console.log(`\n[2/6] 📊 Extracting Performance Metrics...`);

    const metrics = {
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        totalRequests: 0,
        iterations: 0
    };

    if (summary.metrics.http_req_duration) {
        const duration = summary.metrics.http_req_duration;
        metrics.p50ResponseTime = duration['med'] || duration['p(50)'] || 0;
        metrics.p90ResponseTime = duration['p(90)'] || 0;
        metrics.p95ResponseTime = duration['p(95)'] || 0;
        metrics.p99ResponseTime = duration['p(99)'] || 0;
        metrics.avgResponseTime = duration.avg || 0;
        metrics.minResponseTime = duration.min || 0;
        metrics.maxResponseTime = duration.max || 0;
    }

    if (summary.metrics.errors && summary.metrics.errors.value !== undefined) {
        metrics.errorRate = summary.metrics.errors.value * 100;
    } else if (summary.metrics.http_req_failed && summary.metrics.http_req_failed.value !== undefined) {
        metrics.errorRate = summary.metrics.http_req_failed.value * 100;
    }

    if (summary.metrics.http_reqs) {
        metrics.throughput = summary.metrics.http_reqs.rate || 0;
        metrics.totalRequests = summary.metrics.http_reqs.count || 0;
    }

    if (summary.metrics.iterations) {
        metrics.iterations = summary.metrics.iterations.count || 0;
    }

    // Extract Specific Checks Info
    metrics.checksData = [];
    if (summary.root_group && Array.isArray(summary.root_group.checks)) {
        summary.root_group.checks.forEach(check => {
            const checkName = check.name || 'Unknown Check';
            metrics.checksData.push({
                name: checkName,
                passes: check.passes,
                fails: check.fails
            });
        });
    } else if (summary.root_group && summary.root_group.checks && typeof summary.root_group.checks === 'object') {
        Object.values(summary.root_group.checks).forEach(check => {
            const checkName = check.name || 'Unknown Check';
            metrics.checksData.push({
                name: checkName,
                passes: check.passes,
                fails: check.fails
            });
        });
    }

    // Additional Custom metrics extraction from k6
    metrics.endpoints = [];
    if (summary.metrics.browse_duration) {
        metrics.endpoints.push({ name: 'GET /posts (Browse/List)', avgDur: summary.metrics.browse_duration.avg?.toFixed(2) || 0 });
    }
    if (summary.metrics.api_duration) {
        metrics.endpoints.push({ name: 'API Dynamic endpoints (GET/POST)', avgDur: summary.metrics.api_duration.avg?.toFixed(2) || 0 });
    }

    console.log(`      -> P50 Response Time: ${metrics.p50ResponseTime.toFixed(2)} ms`);
    console.log(`      -> P90 Response Time: ${metrics.p90ResponseTime.toFixed(2)} ms`);
    console.log(`      -> P95 Response Time: ${metrics.p95ResponseTime.toFixed(2)} ms`);
    console.log(`      -> P99 Response Time: ${metrics.p99ResponseTime.toFixed(2)} ms`);
    console.log(`      -> Avg Response Time: ${metrics.avgResponseTime.toFixed(2)} ms`);
    console.log(`      -> Error Rate: ${metrics.errorRate.toFixed(2)}%`);
    console.log(`      -> Throughput: ${metrics.throughput.toFixed(2)} req/s`);
    console.log(`      -> Total Requests: ${metrics.totalRequests}`);

    return metrics;
}

module.exports = { runK6LoadTest, extractK6Metrics };
