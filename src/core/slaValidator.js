function validateAgainstSLA(k6Metrics, infraMetrics, runProfile, slaConfig) {
    console.log(`\n[4/6] 📏 Validating against defined SLAs...`);

    const validationResults = [];

    // Get profile-specific thresholds
    const profileSla = slaConfig.profiles[runProfile] || {};
    const performanceSla = { ...slaConfig.performance, ...profileSla };
    const infraSla = slaConfig.infrastructure;

    // Response Time Validations
    validationResults.push({
        metric: 'P50 Response Time (ms)',
        actual: k6Metrics.p50ResponseTime.toFixed(2),
        threshold: `<= ${performanceSla.p50_response_time_ms || 200}`,
        passed: k6Metrics.p50ResponseTime <= (performanceSla.p50_response_time_ms || 200)
    });

    validationResults.push({
        metric: 'P90 Response Time (ms)',
        actual: k6Metrics.p90ResponseTime.toFixed(2),
        threshold: `<= ${performanceSla.p90_response_time_ms || 400}`,
        passed: k6Metrics.p90ResponseTime <= (performanceSla.p90_response_time_ms || 400)
    });

    validationResults.push({
        metric: 'P95 Response Time (ms)',
        actual: k6Metrics.p95ResponseTime.toFixed(2),
        threshold: `<= ${performanceSla.p95_response_time_ms}`,
        passed: k6Metrics.p95ResponseTime <= performanceSla.p95_response_time_ms
    });

    validationResults.push({
        metric: 'P99 Response Time (ms)',
        actual: k6Metrics.p99ResponseTime.toFixed(2),
        threshold: `<= ${performanceSla.p99_response_time_ms || 1000}`,
        passed: k6Metrics.p99ResponseTime <= (performanceSla.p99_response_time_ms || 1000)
    });

    validationResults.push({
        metric: 'Error Rate (%)',
        actual: k6Metrics.errorRate.toFixed(2),
        threshold: `<= ${performanceSla.max_error_rate_percent}`,
        passed: k6Metrics.errorRate <= performanceSla.max_error_rate_percent
    });

    if (performanceSla.min_throughput_rps) {
        validationResults.push({
            metric: 'Throughput (req/s)',
            actual: k6Metrics.throughput.toFixed(2),
            threshold: `>= ${performanceSla.min_throughput_rps}`,
            passed: k6Metrics.throughput >= performanceSla.min_throughput_rps
        });
    }

    // Infrastructure Validations
    if (infraMetrics.avgCpuUsage !== 'N/A') {
        validationResults.push({
            metric: 'CPU Usage (%)',
            actual: infraMetrics.avgCpuUsage,
            threshold: `<= ${infraSla.max_cpu_usage_percent}`,
            passed: parseFloat(infraMetrics.avgCpuUsage) <= infraSla.max_cpu_usage_percent
        });
    }

    if (infraMetrics.avgMemoryUsage !== 'N/A') {
        validationResults.push({
            metric: 'Memory Usage (%)',
            actual: infraMetrics.avgMemoryUsage,
            threshold: `<= ${infraSla.max_memory_usage_percent}`,
            passed: parseFloat(infraMetrics.avgMemoryUsage) <= infraSla.max_memory_usage_percent
        });
    }

    // Print results
    const passCount = validationResults.filter(r => r.passed).length;
    const failCount = validationResults.filter(r => !r.passed).length;

    console.log(`\n      ${'─'.repeat(50)}`);
    validationResults.forEach(res => {
        const icon = res.passed ? '✅' : '❌';
        console.log(`      [${icon}] ${res.metric}: ${res.actual} (threshold: ${res.threshold})`);
    });
    console.log(`      ${'─'.repeat(50)}`);
    console.log(`      📊 Summary: ${passCount}/${validationResults.length} checks passed`);

    return validationResults;
}

module.exports = { validateAgainstSLA };
