const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');

if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const HISTORY_FILE = path.join(REPORTS_DIR, 'history.json');
const REPORT_FILE = path.join(REPORTS_DIR, 'report.html');
const JUNIT_FILE = path.join(REPORTS_DIR, 'junit-report.xml');
const JSON_REPORT_FILE = path.join(REPORTS_DIR, 'report.json');

function saveToHistory(validationResults, metadata = {}) {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); } catch (e) { history = []; }
    }
    const entry = {
        id: `run-${Date.now()}`,
        timestamp: new Date().toISOString(),
        profile: metadata.profile || 'default',
        targetUrl: metadata.targetUrl,
        duration: metadata.duration,
        metrics: {},
        passed: validationResults.filter(r => r.passed).length,
        failed: validationResults.filter(r => !r.passed).length
    };
    validationResults.forEach(r => { entry.metrics[r.metric] = { actual: r.actual, threshold: r.threshold, passed: r.passed }; });
    history.push(entry);
    if (history.length > 50) history = history.slice(-50);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    return history;
}

function generateReport(validationResults, metadata = {}) {
    const history = saveToHistory(validationResults, metadata);
    generateHtmlReport(validationResults, history, metadata);
    generateJUnitReport(validationResults, metadata);
    generateJsonReport(validationResults, metadata);
    console.log('[Report] ✅ All reports generated: HTML, JUnit XML, JSON in reports/');
}

function generateHtmlReport(validationResults, history, metadata) {
    const failed = validationResults.filter(r => !r.passed);
    const passed = validationResults.filter(r => r.passed);
    const passRate = ((passed.length / validationResults.length) * 100).toFixed(0);

    const labels = history.map(h => { const d = new Date(h.timestamp); return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`; });
    const metricKeys = [...new Set(history.flatMap(h => Object.keys(h.metrics)))];
    const chartDatasets = {};
    metricKeys.forEach(key => { chartDatasets[key] = history.map(h => { const val = h.metrics[key]?.actual; return val ? parseFloat(val) : null; }); });
    const slaThresholds = { 'P95 Response Time (ms)': 3000, 'Error Rate (%)': 5, 'CPU Usage (%)': 80, 'Memory Usage (%)': 85 };

    const isSuccess = failed.length === 0;
    const isWarning = failed.length > 0 && failed.length <= 2;
    const statusClass = isSuccess ? 'success' : isWarning ? 'warning' : 'critical';
    const statusEmoji = isSuccess ? '🚀' : isWarning ? '⚠️' : '🚨';

    const metricDescriptions = {
        'P50 Response Time (ms)': 'Median (P50) response time indicates that 50% of the requests were served within this time. It reflects the typical user experience.',
        'P90 Response Time (ms)': 'P90 response time signifies that 90% of requests were faster than this value. It helps identify issues affecting a minority of users.',
        'P95 Response Time (ms)': 'P95 response time means 95% of requests met this speed. This is a critical SLA metric for tracking performance outliers.',
        'P99 Response Time (ms)': 'P99 response time captures the slowest 1% of requests. High values here often indicate serious tail-latency issues (e.g., GC pauses, DB locks).',
        'Error Rate (%)': 'The percentage of requests that failed (e.g., HTTP 5xx errors or failed assertions). A high error rate indicates system instability.',
        'Throughput (req/s)': 'The number of requests the system successfully processed per second. Relates directly to the system\'s capacity.',
        'CPU Usage (%)': 'Average CPU utilization on the target servers during the test. High usage may lead to throttling and increased response times.',
        'Memory Usage (%)': 'Average memory consumption. Approaching 100% can trigger Out-Of-Memory (OOM) kills or heavy swapping.'
    };

    // Summary Generation
    let summaryInsight = '';
    if (isSuccess) {
        summaryInsight = `The system handled the <strong>${metadata.profile?.toUpperCase() || 'DEFAULT'}</strong> load profile exceptionally well. All SLA thresholds were strictly met with no critical bottlenecks. Throughput and response times remained stable within acceptable parameters.`;
    } else {
        const failedMetrics = failed.map(f => f.metric).join(', ');
        summaryInsight = `The system experienced performance degradation under the <strong>${metadata.profile?.toUpperCase() || 'DEFAULT'}</strong> load profile. We detected ${failed.length} SLA violations, specifically impacting: <span style="color: var(--danger-color); font-weight: 600;">${failedMetrics}</span>. Immediate optimization is recommended for the affected areas.`;
    }

    // Detailed Endpoint breakdown
    let endpointBreakdownHtml = '';
    let checksBreakdownHtml = '';

    if (metadata.k6Metrics && metadata.k6Metrics.endpoints && metadata.k6Metrics.endpoints.length > 0) {
        endpointBreakdownHtml = `
            <div class="glass-panel table-container animate-fade-up delay-4" style="margin-top: 24px;">
                <div class="table-header">
                    <h3>Endpoint Performance Details</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Endpoint Name</th>
                            <th>Average Latency (ms)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metadata.k6Metrics.endpoints.map(ep => `
                        <tr>
                            <td style="font-weight: 500;">${ep.name}</td>
                            <td style="font-family: var(--font-mono);">${ep.avgDur} ms</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    if (metadata.k6Metrics && metadata.k6Metrics.checksData && metadata.k6Metrics.checksData.length > 0) {
        checksBreakdownHtml = `
            <div class="glass-panel table-container animate-fade-up delay-4" style="margin-top: 24px;">
                <div class="table-header">
                    <h3>Detailed Scenario Execution Checks</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Check Name</th>
                            <th>Passed</th>
                            <th>Failed</th>
                            <th>Success Rate (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metadata.k6Metrics.checksData.map(ck => {
            const total = ck.passes + ck.fails;
            const rate = total > 0 ? ((ck.passes / total) * 100).toFixed(1) : 0;
            const rateColor = rate === '100.0' ? 'var(--success-color)' : (rate > 0 ? 'var(--warning-color)' : 'var(--danger-color)');
            return `
                            <tr>
                                <td style="font-weight: 500;">${ck.name}</td>
                                <td style="font-family: var(--font-mono); color: var(--success-color);">${ck.passes}</td>
                                <td style="font-family: var(--font-mono); color: ${ck.fails > 0 ? 'var(--danger-color)' : 'var(--text-secondary)'};">${ck.fails}</td>
                                <td style="font-family: var(--font-mono); font-weight: bold; color: ${rateColor};">${rate}%</td>
                            </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Response Time Distribution Chart Data
    let responseTimeChartHtml = '';
    if (metadata.k6Metrics && metadata.k6Metrics.p50ResponseTime !== undefined) {
        responseTimeChartHtml = `
            <div class="glass-panel chart-wrapper animate-fade-up delay-4" style="margin-top: 24px;">
                <h4>Response Time Distribution (ms)</h4>
                <div style="position: relative; height: 260px; width: 100%;">
                    <canvas id="chart_rt_distribution"></canvas>
                </div>
            </div>
        `;
    }

    // Comparison with Previous Run
    let comparisonHtml = '';
    if (history.length >= 2) {
        const current = history[history.length - 1];
        const previous = history[history.length - 2];
        const comparisons = [];
        Object.keys(current.metrics).forEach(key => {
            if (previous.metrics[key]) {
                const currVal = parseFloat(current.metrics[key].actual);
                const prevVal = parseFloat(previous.metrics[key].actual);
                if (!isNaN(currVal) && !isNaN(prevVal) && prevVal !== 0) {
                    const delta = ((currVal - prevVal) / prevVal * 100).toFixed(1);
                    const isImproved = key.includes('Throughput') ? currVal > prevVal : currVal < prevVal;
                    comparisons.push({ metric: key, current: currVal, previous: prevVal, delta, isImproved });
                }
            }
        });
        comparisonHtml = `
            <div class="glass-panel table-container animate-fade-up delay-4" style="margin-top: 24px;">
                <div class="table-header">
                    <h3>📊 Run Comparison (Current vs Previous)</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Previous</th>
                            <th>Current</th>
                            <th>Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comparisons.map(c => `
                        <tr>
                            <td style="font-weight: 500;">${c.metric}</td>
                            <td style="font-family: var(--font-mono); color: var(--text-secondary);">${c.previous}</td>
                            <td style="font-family: var(--font-mono);">${c.current}</td>
                            <td style="font-family: var(--font-mono); font-weight: 600; color: ${c.isImproved ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${c.isImproved ? '↓' : '↑'} ${Math.abs(c.delta)}%
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Alert Severity Assessment
    let alertSeverityHtml = '';
    const alertConfig = metadata.slaConfig?.alerts || { critical: { p95_response_time_ms: 2000, max_error_rate_percent: 10 }, warning: { p95_response_time_ms: 800, max_error_rate_percent: 3 } };
    if (metadata.k6Metrics) {
        const km = metadata.k6Metrics;
        let severityLevel = 'HEALTHY';
        let severityColor = 'var(--success-color)';
        let severityIcon = '🟢';
        let severityBg = 'var(--success-glow)';

        if (km.p95ResponseTime > alertConfig.critical.p95_response_time_ms || km.errorRate > alertConfig.critical.max_error_rate_percent) {
            severityLevel = 'CRITICAL'; severityColor = 'var(--danger-color)'; severityIcon = '🔴'; severityBg = 'var(--danger-glow)';
        } else if (km.p95ResponseTime > alertConfig.warning.p95_response_time_ms || km.errorRate > alertConfig.warning.max_error_rate_percent) {
            severityLevel = 'WARNING'; severityColor = 'var(--warning-color)'; severityIcon = '🟡'; severityBg = 'var(--warning-glow)';
        }

        alertSeverityHtml = `
            <div class="glass-panel animate-fade-up delay-2" style="margin-top: 16px; padding: 20px; border-left: 4px solid ${severityColor}; background: ${severityBg};">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.8rem;">${severityIcon}</span>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary);">Alert Severity Level</span>
                        <h3 style="font-size: 1.4rem; color: ${severityColor}; margin-top: 4px;">${severityLevel}</h3>
                    </div>
                </div>
                <p style="margin-top: 12px; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;">
                    P95 Response Time: <strong style="color: var(--text-primary);">${km.p95ResponseTime?.toFixed(2) || 'N/A'} ms</strong> 
                    (Warning: ≤${alertConfig.warning.p95_response_time_ms}ms, Critical: ≤${alertConfig.critical.p95_response_time_ms}ms) | 
                    Error Rate: <strong style="color: var(--text-primary);">${km.errorRate?.toFixed(2) || 'N/A'}%</strong>
                    (Warning: ≤${alertConfig.warning.max_error_rate_percent}%, Critical: ≤${alertConfig.critical.max_error_rate_percent}%)
                </p>
            </div>
        `;
    }

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SLA Performance Report | ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #09090b;
            --surface-color: rgba(255, 255, 255, 0.03);
            --surface-hover: rgba(255, 255, 255, 0.05);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --success-color: #10b981;
            --success-glow: rgba(16, 185, 129, 0.2);
            --warning-color: #f59e0b;
            --warning-glow: rgba(245, 158, 11, 0.2);
            --danger-color: #ef4444;
            --danger-glow: rgba(239, 68, 68, 0.2);
            --accent-color: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.25);
            --radius-lg: 24px;
            --radius-md: 16px;
            --radius-sm: 8px;
            --font-sans: 'Inter', system-ui, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

        body {
            font-family: var(--font-sans);
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.08), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.08), transparent 25%);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            overflow-x: hidden;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 40px 24px;
        }

        /* Glassmorphism Classes */
        .glass-panel {
            background: var(--surface-color);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .glass-panel:hover {
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 20px rgba(99, 102, 241, 0.05);
            transform: translateY(-2px);
        }

        /* Typography */
        h1, h2, h3, h4 { letter-spacing: -0.02em; font-weight: 700; }
        .text-gradient {
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* Header Layout */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 48px;
            padding-bottom: 32px;
            border-bottom: 1px solid var(--border-color);
            position: relative;
        }
        
        .header-title h1 {
            font-size: 2.5rem;
            margin-bottom: 8px;
        }
        .header-title p {
            color: var(--text-secondary);
            font-size: 1.1rem;
        }
        
        .header-meta {
            display: flex;
            gap: 16px;
        }
        
        .meta-pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 40px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            color: var(--text-secondary);
            font-family: var(--font-mono);
        }

        /* Main Layout - Single column, no sidebar */
        .hero-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 32px;
            padding: 40px;
            margin-bottom: 24px;
        }

        .hero-left {
            display: flex;
            align-items: center;
            gap: 32px;
        }

        .hero-right {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }

        .hero-stat {
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            min-width: 160px;
        }

        .hero-stat-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-secondary);
            margin-bottom: 4px;
        }

        .hero-stat-value {
            font-size: 1rem;
            font-weight: 600;
            font-family: var(--font-mono);
            color: var(--text-primary);
        }

        @media (max-width: 900px) {
            .hero-banner { flex-direction: column; align-items: center; text-align: center; }
            .hero-right { grid-template-columns: 1fr 1fr; }
            header { flex-direction: column; align-items: flex-start; gap: 24px; }
        }

        .status-hero {
            padding: 0;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        
        .status-hero .emoji {
            font-size: 3rem;
            filter: drop-shadow(0 0 20px currentColor);
        }
        
        .status-success { color: var(--success-color); border-color: rgba(16, 185, 129, 0.3); background: linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%); }
        .status-warning { color: var(--warning-color); border-color: rgba(245, 158, 11, 0.3); background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%); }
        .status-critical { color: var(--danger-color); border-color: rgba(239, 68, 68, 0.3); background: linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%); }

        .pass-rate-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 800;
            font-family: var(--font-mono);
            flex-shrink: 0;
            position: relative;
        }
        
        .pass-rate-circle::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            padding: 6px;
            background: conic-gradient(currentColor ${passRate}%, rgba(255,255,255,0.05) 0);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
        }

        .status-text h2 {
            font-size: 1.5rem;
            margin-bottom: 4px;
        }

        .status-text p {
            font-size: 0.9rem;
            opacity: 0.7;
        }

        /* Compact Metrics row inside main content */
        .metrics-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 24px;
            margin-bottom: 24px;
        }

        .metric-card {
            padding: 24px;
            display: flex;
            flex-direction: column;
        }
        
        .metric-label {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        
        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            font-family: var(--font-mono);
        }

        /* Detailed Table */
        .table-container {
            padding: 0;
            overflow: hidden;
            margin-bottom: 24px;
        }
        
        .table-header {
            padding: 24px;
            border-bottom: 1px solid var(--border-color);
            background: rgba(255,255,255,0.01);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            padding: 16px 24px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-color);
            font-weight: 600;
        }

        td {
            padding: 16px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 0.95rem;
        }

        tr:last-child td { border-bottom: none; }
        
        tr { transition: background 0.2s; }
        tr:hover { background: rgba(255, 255, 255, 0.02); }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 40px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .badge-pass { background: var(--success-glow); color: var(--success-color); border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-fail { background: var(--danger-glow); color: var(--danger-color); border: 1px solid rgba(239, 68, 68, 0.3); }

        /* Charts area */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
            margin-top: 32px;
        }

        .chart-wrapper {
            position: relative;
            height: 300px;
            width: 100%;
            padding: 24px;
        }

        .chart-wrapper h4 {
            margin-bottom: 16px;
            font-size: 1rem;
            color: var(--text-secondary);
        }

        .tooltip-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-secondary);
            font-size: 10px;
            font-weight: bold;
            cursor: help;
            margin-left: 8px;
            transition: background 0.2s;
            position: relative;
        }
        .tooltip-icon:hover {
            background: rgba(255, 255, 255, 0.2);
            color: var(--text-primary);
        }
        .tooltip-icon::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 150%;
            left: 50%;
            transform: translateX(-50%);
            width: max-content;
            max-width: 300px;
            background: rgba(15, 23, 42, 0.95);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.75rem;
            text-transform: none;
            letter-spacing: normal;
            font-family: var(--font-sans);
            font-weight: 400;
            line-height: 1.4;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            text-align: left;
            z-index: 10;
        }
        .tooltip-icon:hover::after {
            opacity: 1;
        }

        /* Animations */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-up {
            animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
        }
        
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }
    </style>
</head>
<body>
    <div class="container">
        
        <header class="animate-fade-up">
            <div class="header-title">
                <h1 class="text-gradient">Performance & Observability Matrix</h1>
                <p>Advanced system SLA validation and health metrics over time.</p>
            </div>
        </header>

        <!-- Hero Banner: Pass Rate & Status -->
        <div class="glass-panel hero-banner status-${statusClass} animate-fade-up delay-1">
            <div class="hero-left">
                <div class="pass-rate-circle">
                    ${passRate}%
                </div>
                <div class="status-hero status-${statusClass}">
                    <div class="emoji">${statusEmoji}</div>
                    <div class="status-text">
                        <h2>${isSuccess ? 'All SLA Checks Passed' : (failed.length + ' SLA Violation' + (failed.length > 1 ? 's' : '') + ' Detected')}</h2>
                        <p>${passed.length} of ${validationResults.length} checks passed target thresholds</p>
                    </div>
                </div>
            </div>
            <div class="hero-right">
                <div class="hero-stat">
                    <div class="hero-stat-label">Profile</div>
                    <div class="hero-stat-value">${metadata.profile?.toUpperCase() || 'DEFAULT'}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-label">Duration</div>
                    <div class="hero-stat-value">${metadata.duration || 'N/A'}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-label">Target URL</div>
                    <div class="hero-stat-value" style="font-size: 0.8rem; word-break: break-all;">${metadata.targetUrl || 'N/A'}</div>
                </div>
                <div class="hero-stat">
                    <div class="hero-stat-label">Timestamp</div>
                    <div class="hero-stat-value" style="font-size: 0.85rem;">${new Date().toLocaleString()}</div>
                </div>
            </div>
        </div>

        ${alertSeverityHtml}

        <!-- Executive Summary -->
        <div class="glass-panel animate-fade-up delay-2" style="padding: 24px; margin-bottom: 24px;">
            <span class="metric-label" style="display: flex; gap: 8px; align-items: center;"><span style="font-size: 1.2rem;">💡</span> EXECUTIVE SUMMARY</span>
            <p style="font-size: 1.05rem; color: var(--text-primary); line-height: 1.8; margin-top: 8px;">${summaryInsight}</p>
        </div>

        <!-- SLA Validations Checklist -->
        <div class="glass-panel table-container animate-fade-up delay-3">
            <div class="table-header">
                <h3>SLA Validations Checklist</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Metric Examined</th>
                        <th>Actual Observed</th>
                        <th>Defined SLA Threshold</th>
                        <th>Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${validationResults.map(item => `
                    <tr>
                        <td style="font-weight: 500; display: flex; align-items: center;">
                            ${item.metric}
                            <span class="tooltip-icon" data-tooltip="${metricDescriptions[item.metric] || 'No description available'}">?</span>
                        </td>
                        <td style="font-family: var(--font-mono);">${item.actual}</td>
                        <td style="font-family: var(--font-mono); color: var(--text-secondary);">${item.threshold.replace('<=', '≤').replace('>=', '≥')}</td>
                        <td>
                            <span class="badge ${item.passed ? 'badge-pass' : 'badge-fail'}">
                                ${item.passed ? '✅ PASS' : '❌ FAIL'}
                            </span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${endpointBreakdownHtml}
        ${checksBreakdownHtml}
        ${responseTimeChartHtml}
        ${comparisonHtml}

        <h3 class="animate-fade-up delay-3" style="margin-top: 24px; margin-bottom: 16px;">System Telemetry Timeline</h3>
        <div class="charts-grid animate-fade-up delay-4">
            ${generateChartCard('P95 Response Time (ms)', labels, chartDatasets['P95 Response Time (ms)'], slaThresholds['P95 Response Time (ms)'], '#6366f1')}
            ${generateChartCard('Error Rate (%)', labels, chartDatasets['Error Rate (%)'], slaThresholds['Error Rate (%)'], '#ef4444')}
            ${chartDatasets['CPU Usage (%)']?.some(v => v !== null) ? generateChartCard('CPU Usage (%)', labels, chartDatasets['CPU Usage (%)'], slaThresholds['CPU Usage (%)'], '#10b981') : ''}
            ${chartDatasets['Memory Usage (%)']?.some(v => v !== null) ? generateChartCard('Memory Usage (%)', labels, chartDatasets['Memory Usage (%)'], slaThresholds['Memory Usage (%)'], '#f59e0b') : ''}
        </div>
        
    </div>

    <script>
        ${generateChartScripts(chartDatasets, labels, slaThresholds, metadata)}
    </script>
</body>
</html>`;

    console.log('[Report] 🎨 HTML modern layout prepared');
    fs.writeFileSync(REPORT_FILE, reportHtml);
}

function generateChartCard(title, labels, data, _threshold, _color) {
    if (!data || data.every(v => v === null)) return '';
    const chartId = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    return `
    <div class="glass-panel chart-wrapper">
        <h4>${title}</h4>
        <div style="position: relative; height: 230px; width: 100%;">
            <canvas id="chart_${chartId}"></canvas>
        </div>
    </div>
    `;
}

function generateChartScripts(chartDatasets, labels, slaThresholds, metadata) {
    let scripts = '';

    const colors = {
        'P95 Response Time (ms)': { bg: 'rgba(99, 102, 241, 0.1)', border: '#818cf8' },
        'Error Rate (%)': { bg: 'rgba(239, 68, 68, 0.1)', border: '#f87171' },
        'CPU Usage (%)': { bg: 'rgba(16, 185, 129, 0.1)', border: '#34d399' },
        'Memory Usage (%)': { bg: 'rgba(245, 158, 11, 0.1)', border: '#fbbf24' }
    };

    for (const [metricName, data] of Object.entries(chartDatasets)) {
        if (!data || data.every(v => v === null)) continue;

        const chartId = metricName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const color = colors[metricName] || { bg: 'rgba(99, 102, 241, 0.1)', border: '#818cf8' };
        const threshold = slaThresholds[metricName];

        scripts += `
        (function() {
            const ctx = document.getElementById('chart_${chartId}');
            if (!ctx) return;
            
            // gradient for line chart
            const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, '${color.bg.replace('0.1', '0.4')}');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: '${metricName}',
                        data: ${JSON.stringify(data)},
                        backgroundColor: gradient,
                        borderColor: '${color.border}',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointBackgroundColor: '${color.border}',
                        pointBorderColor: '#09090b',
                        pointBorderWidth: 2,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            cornerRadius: 8
                        },
                        ${threshold ? `annotation: {
                            annotations: {
                                line1: {
                                    type: 'line',
                                    yMin: ${threshold},
                                    yMax: ${threshold},
                                    borderColor: 'rgba(2ef, 68, 68, 0.5)',
                                    borderWidth: 1,
                                    borderDash: [5, 5],
                                }
                            }
                        },` : ''}
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                            border: { display: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { family: "'JetBrains Mono', monospace", size: 10 } }
                        },
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                            border: { display: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { family: "'JetBrains Mono', monospace", size: 10 } }
                        }
                    }
                }
            });
        })();
        `;
    }

    // Response Time Distribution Bar Chart
    if (metadata && metadata.k6Metrics && metadata.k6Metrics.p50ResponseTime !== undefined) {
        const km = metadata.k6Metrics;
        scripts += `
        (function() {
            const ctx = document.getElementById('chart_rt_distribution');
            if (!ctx) return;
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['P50 (Median)', 'P90', 'P95', 'P99', 'Avg', 'Max'],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [${km.p50ResponseTime?.toFixed(2) || 0}, ${km.p90ResponseTime?.toFixed(2) || 0}, ${km.p95ResponseTime?.toFixed(2) || 0}, ${km.p99ResponseTime?.toFixed(2) || 0}, ${km.avgResponseTime?.toFixed(2) || 0}, ${km.maxResponseTime?.toFixed(2) || 0}],
                        backgroundColor: [
                            'rgba(16, 185, 129, 0.7)',
                            'rgba(99, 102, 241, 0.7)',
                            'rgba(245, 158, 11, 0.7)',
                            'rgba(239, 68, 68, 0.7)',
                            'rgba(139, 92, 246, 0.7)',
                            'rgba(236, 72, 153, 0.7)'
                        ],
                        borderColor: [
                            '#10b981',
                            '#6366f1',
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6',
                            '#ec4899'
                        ],
                        borderWidth: 2,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    return context.parsed.y.toFixed(2) + ' ms';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                            border: { display: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { family: "'JetBrains Mono', monospace", size: 10 }, callback: function(v) { return v + ' ms'; } }
                        },
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: "'Inter', sans-serif", size: 11, weight: 500 } }
                        }
                    }
                }
            });
        })();
        `;
    }

    return scripts;
}

function generateJUnitReport(validationResults, metadata) {
    const failed = validationResults.filter(r => !r.passed);

    let junit = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    junit += `<testsuites name="Performance-Observability-Validation" tests="${validationResults.length}" failures="${failed.length}" errors="0" time="${metadata.duration || 0}">\n`;
    junit += `    <testsuite name="SLA-Validation" tests="${validationResults.length}" failures="${failed.length}" errors="0" timestamp="${new Date().toISOString()}">\n`;

    validationResults.forEach((result) => {
        const safeName = result.metric.replace(/[^a-zA-Z0-9]/g, '_');

        if (result.passed) {
            junit += `        <testcase name="${safeName}" classname="SLAValidation" time="0"/>\n`;
        } else {
            junit += `        <testcase name="${safeName}" classname="SLAValidation" time="0">\n`;
            junit += `            <failure message="${result.metric} exceeded threshold" type="SLAViolation">\n`;
            junit += `                Expected: ${result.threshold}\n`;
            junit += `                Actual: ${result.actual}\n`;
            junit += `            </failure>\n`;
            junit += `        </testcase>\n`;
        }
    });

    junit += `    </testsuite>\n</testsuites>`;
    fs.writeFileSync(JUNIT_FILE, junit);
}

function generateJsonReport(validationResults, metadata) {
    const report = {
        id: `report-${Date.now()}`,
        timestamp: new Date().toISOString(),
        metadata: {
            profile: metadata.profile || 'default',
            targetUrl: metadata.targetUrl,
            duration: metadata.duration
        },
        summary: {
            total: validationResults.length,
            passed: validationResults.filter(r => r.passed).length,
            failed: validationResults.filter(r => !r.passed).length,
            passRate: ((validationResults.filter(r => r.passed).length / validationResults.length) * 100).toFixed(2) + '%'
        },
        results: validationResults,
        status: validationResults.every(r => r.passed) ? 'PASSED' : 'FAILED'
    };
    fs.writeFileSync(JSON_REPORT_FILE, JSON.stringify(report, null, 2));
}

module.exports = {
    generateReport,
    saveToHistory,
    generateJUnitReport,
    generateHtmlReport,
    generateJsonReport
};