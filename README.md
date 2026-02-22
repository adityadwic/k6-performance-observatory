# 🚀 Performance & Observability Validation Framework

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![K6](https://img.shields.io/badge/K6-Load_Testing-7D5694?logo=k6&logoColor=white)](https://k6.io/)
[![Jest](https://img.shields.io/badge/Jest-21_Tests-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![GitHub Actions](https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

An **enterprise-grade** performance testing & observability framework built by a **Senior QA Engineer**. Goes beyond traditional load testing by correlating **client-side performance metrics** (K6) with **server-side system health** (Prometheus/Grafana) and validating everything against **configurable SLAs**.

> 🎯 **Demo Target**: [JSONPlaceholder](https://jsonplaceholder.typicode.com) — swap with your own API endpoint via `.env`

---

## 📸 Report Preview

The framework generates a **modern dark-themed HTML dashboard** with:

<table>
<tr>
<td width="50%">

### Hero Banner
- 🟢 Pass rate percentage ring (animated)
- Status: HEALTHY / WARNING / CRITICAL  
- Test metadata (profile, duration, target)

</td>
<td width="50%">

### Data Sections
- 📊 SLA Validation Checklist with tooltip descriptions
- 📈 Response Time Distribution (P50-P99 bar chart)
- 🔄 Run Comparison — delta vs previous run
- ✅ Detailed Scenario Checks breakdown

</td>
</tr>
</table>

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **🎯 Scenario-Based Testing** | Weighted distribution across browse, detail, create, health, and negative test scenarios |
| **📊 Multi-Metric Validation** | P50, P90, P95, P99 response times + error rate + throughput |
| **🔍 Response Body Validation** | JSON schema checks — verifies structure, not just status codes |
| **🔧 Profile-Based SLAs** | Different thresholds for `smoke`, `default`, `stress`, `spike` profiles |
| **📈 Prometheus Integration** | Real-time CPU, memory, disk, and network metrics during tests |
| **🚨 Alert Severity Engine** | Auto-classifies results as `HEALTHY` / `WARNING` / `CRITICAL` |
| **📊 Run Comparison** | Automated ↑↓ delta analysis against previous test run |
| **📈 Distribution Charts** | Bar chart of P50/P90/P95/P99/Avg/Max response time |
| **📉 Trend Analysis** | Historical sparkline charts across multiple runs |
| **🔔 Multi-Channel Alerts** | Slack, Discord, MS Teams, Email (SendGrid) |
| **🤖 CI/CD Pipeline** | GitHub Actions workflow with JUnit XML + baseline comparison |
| **🧪 21 Unit Tests** | Full coverage across K6 Runner, SLA Validator, and Reporter |

---

## 🌟 Why is this "Senior Level"?

| Traditional Load Testing | This Framework |
|--------------------------|----------------|
| Hit one endpoint, check response time | Multi-scenario weighted distribution with schema validation |
| P95 response time only | P50, P90, P95, P99 + throughput + error rate |
| Manual spreadsheet analysis | Automated SLA engine with alert severity classification |
| Static PDF reports | Interactive dark-themed HTML dashboard with Chart.js |
| No infra visibility | Prometheus/Grafana correlation |
| Manual CI integration | Ready-to-use GitHub Actions with regression detection |
| No comparison data | Run-over-run delta tracking with ↑↓ indicators |

---

## 📂 Project Structure

```
├── .env                          # Environment configuration
├── .gitignore                    # Git ignore rules
├── .eslintrc.json                # ESLint configuration
├── .prettierrc                   # Prettier formatting config
├── .github/workflows/
│   └── performance-test.yml      # CI/CD pipeline
├── index.js                      # 🚦 Main Orchestrator
├── package.json                  # Dependencies & scripts
│
├── __tests__/                    # 🧪 Unit Tests (21 tests, 3 suites)
│   ├── slaValidator.test.js      # SLA threshold validation tests
│   ├── k6Runner.test.js          # K6 metric extraction tests
│   └── reporter.test.js          # Report generation tests
│
└── src/
    ├── config/
    │   └── sla.json              # 📏 SLA thresholds per profile + alert levels
    ├── core/
    │   ├── k6Runner.js           # 🏎️ K6 execution & metric extraction
    │   └── slaValidator.js       # 📏 SLA validation engine
    ├── tests/
    │   └── load_test.js          # 🏎️ K6 Load Test Script (5 scenarios)
    └── utils/
        ├── grafana.js            # 📊 Grafana Annotations
        ├── notifier.js           # 🔔 Multi-channel Notifications
        ├── prometheus.js         # 📡 Prometheus Integration
        └── reporter.js           # 📈 HTML/JSON/JUnit Report Generator
```

---

## ⚙️ Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| **Node.js** | v18+ | ✅ Yes |
| **K6 CLI** | Latest | ✅ Yes |
| **Prometheus** | Latest | ❌ Optional |
| **Grafana** | Latest | ❌ Optional |

### Install K6

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C4914A4B7C3C
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure target (optional — defaults to JSONPlaceholder)
cp .env.example .env
# Edit .env with your target URL

# 3. Run tests
npm start                        # Default profile
npm start -- --profile=smoke     # Quick smoke test
npm start -- --profile=stress    # High load test
npm start -- --profile=spike     # Spike test

# 4. Run unit tests
npm test

# 5. View report
open reports/report.html
```

---

## 📊 Test Profiles

| Profile | VUs | Duration | P95 Threshold | Error Rate | Use Case |
|---------|-----|----------|---------------|------------|----------|
| `smoke` | 5 | 1m | ≤ 1500ms | ≤ 1% | Basic sanity check |
| `default` | 10 | 30s | ≤ 3000ms | ≤ 5% | Standard validation |
| `stress` | 50 | 2m | ≤ 5000ms | ≤ 10% | Capacity testing |
| `spike` | 200 | 50s | ≤ 8000ms | ≤ 15% | Sudden burst handling |

---

## 🧪 Test Scenarios

The K6 script executes **5 weighted scenarios** to simulate realistic traffic:

| Scenario | Weight | Method | Endpoint | Validations |
|----------|--------|--------|----------|-------------|
| **Browse Posts** | 40% | `GET` | `/posts` | Status 200, RT < 3s, JSON array, schema check |
| **Post Detail** | 30% | `GET` | `/posts/:id` | Status 200, RT < 3s, valid id/body fields |
| **Create Post** | 15% | `POST` | `/posts` | Status 201, RT < 4s, returns id |
| **Health Check** | 10% | `GET` | `/` | Status 200, RT < 2s |
| **Negative Test** | 5% | `GET` | `/invalid_path` | Status 404 (validates error handling) |

---

## 📏 SLA Configuration

Thresholds are defined in `src/config/sla.json`:

```json
{
  "performance": {
    "p50_response_time_ms": 800,
    "p90_response_time_ms": 2000,
    "p95_response_time_ms": 3000,
    "p99_response_time_ms": 8000,
    "max_error_rate_percent": 5,
    "min_throughput_rps": 2
  },
  "alerts": {
    "warning": { "p95_response_time_ms": 2000, "max_error_rate_percent": 8 },
    "critical": { "p95_response_time_ms": 5000, "max_error_rate_percent": 20 }
  }
}
```

---

## 📈 Generated Reports

| File | Format | Purpose |
|------|--------|---------|
| `reports/report.html` | HTML | Interactive dashboard with charts & comparison |
| `reports/report.json` | JSON | Machine-readable results for CI/CD |
| `reports/junit-report.xml` | XML | JUnit-compatible for GitHub/Jenkins/GitLab |
| `reports/k6-summary.json` | JSON | Raw K6 metrics data |
| `reports/history.json` | JSON | Historical run data for trend analysis |

### HTML Report Sections

| Section | Description |
|---------|-------------|
| **🎯 Hero Banner** | Pass rate circle, status badge, test metadata |
| **🚨 Alert Severity** | HEALTHY / WARNING / CRITICAL with threshold context |
| **💡 Executive Summary** | AI-generated natural language insight |
| **📊 SLA Checklist** | Each metric vs threshold with PASS/FAIL badge + tooltips |
| **📡 Endpoint Details** | Per-endpoint average latency breakdown |
| **✅ Scenario Checks** | Detailed check pass/fail with success rate percentage |
| **📈 RT Distribution** | P50/P90/P95/P99/Avg/Max bar chart |
| **🔄 Run Comparison** | Current vs previous with ↑↓ delta percentage |
| **📉 Telemetry Timeline** | Historical trend line charts per metric |

---

## 🔔 Notifications

### Supported Channels

| Platform | Detection | Format |
|----------|-----------|--------|
| **Slack** | `slack.com` in URL | Rich blocks + action buttons |
| **Discord** | `discord.com` in URL | Embeds + role mentions |
| **MS Teams** | `office.com` in URL | Adaptive cards |
| **Email** | SendGrid API | HTML template |

```env
# Slack/Discord/Teams
WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/XXXX

# Email (SendGrid)
EMAIL_ENABLED=true
EMAIL_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@perf-qa.com
EMAIL_TO=team@example.com
```

---

## 🤖 CI/CD — GitHub Actions

The pipeline (`performance-test.yml`) supports:

- ⚡ **Manual trigger** — select profile via GitHub UI
- ⏰ **Scheduled runs** — daily at 2 AM UTC
- 🔄 **Push triggers** — auto-run on `main` branch changes
- 📊 **Baseline comparison** — detects >20% P95 regression
- 📦 **Artifact storage** — 30-day report retention
- 💬 **PR comments** — auto-post results on pull requests

```bash
# Trigger manually via CLI
gh workflow run performance-test.yml -f profile=stress
```

---

## 🎯 CLI Reference

```bash
npm start -- [options]

Options:
  --profile, -p <name>    Test profile: smoke | default | stress | spike
  --skip-k6               Skip K6 execution, use existing results
  --dry-run               Verify configuration without running tests
```

---

## 📊 Example Output

```
════════════════════════════════════════════════════════════
🚀 Advanced Performance & Observability Validation
════════════════════════════════════════════════════════════
🎯 Target URL: https://jsonplaceholder.typicode.com
🎛️  Workload Profile: DEFAULT
📅 Started at: 2/22/2026, 1:45:00 PM
════════════════════════════════════════════════════════════

[1/6] 🏎️  Running K6 Load Test (default profile)...
[2/6] 📊 Extracting Performance Metrics...
      -> P50 Response Time: 194.52 ms
      -> P90 Response Time: 1696.53 ms
      -> P95 Response Time: 1997.62 ms
      -> P99 Response Time: 3119.71 ms
      -> Error Rate: 2.17%
      -> Throughput: 2.91 req/s

[4/6] 📏 Validating against defined SLAs...
      ──────────────────────────────────────────────────
      [✅] P50 Response Time (ms): 194.52 (threshold: ≤ 800)
      [✅] P90 Response Time (ms): 1696.53 (threshold: ≤ 2000)
      [✅] P95 Response Time (ms): 1997.62 (threshold: ≤ 3000)
      [✅] P99 Response Time (ms): 3119.71 (threshold: ≤ 8000)
      [✅] Error Rate (%): 2.17 (threshold: ≤ 5)
      [✅] Throughput (req/s): 2.91 (threshold: ≥ 2)
      ──────────────────────────────────────────────────
      📊 Summary: 6/6 checks passed

════════════════════════════════════════════════════════════
🎉 Process completed for profile: default
⏱️  Total Duration: 35.33s
📊 Results: 6/6 checks passed
════════════════════════════════════════════════════════════
```

---

## 🛠️ Extending the Framework

### Add a Custom Scenario

```javascript
// In src/tests/load_test.js
const scenarios = {
  myCustomScenario: () => {
    const res = http.post(`${BASE_URL}/api/data`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'custom', method: 'POST' }
    });

    const body = res.json();
    check(res, {
      'status is 200': (r) => r.status === 200,
      'has expected field': () => body.id !== undefined,
    }, { endpoint: 'custom' });
  }
};

// Add weight for it
const scenarioWeights = {
  browse: 0.35, detail: 0.25, login: 0.15,
  custom: 0.15, invalid: 0.05, health: 0.05
};
```

---

## 📡 Prometheus Queries

```promql
# CPU Usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)

# Memory Usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk I/O
rate(node_disk_io_time_seconds_total[1m])

# Network Traffic
rate(node_network_receive_bytes_total[1m])
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📚 Resources

- [K6 Documentation](https://k6.io/docs/)
- [Prometheus Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [GitHub Actions Workflow](https://docs.github.com/en/actions)
- [JSONPlaceholder API](https://jsonplaceholder.typicode.com/)

---

<p align="center">Built with ❤️ for the QA Engineering Community</p>