# 🚀 Advanced Performance & Observability Validation Framework

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/K6-Load_Testing-7D5694?logo=k6&logoColor=white" alt="K6" />
  <img src="https://img.shields.io/badge/Jest-21_Tests-C21325?logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <br/>
  <strong>An enterprise-grade performance testing & observability framework designed to validate client-side performance against server-side system health.</strong>
</div>

<br/>

> 👨‍💻 **Portfolio Project by [Aditya Dwi Cahyono](https://github.com/adityadwic)** — Quality Assurance Engineer
> 🎯 **Demo Target**: [JSONPlaceholder](https://jsonplaceholder.typicode.com) — configurable via `.env`

---

## 📖 Overview

This project serves as a showcase of **Senior QA Engineering** practices. It moves beyond traditional load testing (which typically just pings an endpoint and checks response times) and implements a robust framework that correlates **K6 performance metrics** with **Prometheus/Grafana infrastructure observability**, validating all outcomes against strict, **profile-based SLAs**.

### 💼 What this project demonstrates:
- **Advanced Load Testing:** Scenario-based workload modeling using K6.
- **Observability Integration:** Telemetry data correlation (Prometheus/Grafana).
- **Automated SLA Validation:** Dynamic pipeline thresholds that catch regressions.
- **Reporting & Notifications:** Custom dark-themed HTML dashboards and multi-channel alerting (Slack, Discord, Teams).
- **CI/CD Excellence:** Fully automated GitHub Actions pipeline with historical baseline tracking.

---

## 📸 Report Preview

The framework generates a **modern dark-themed HTML dashboard** to provide clear, actionable insights for both engineers and stakeholders.
<img width="1439" height="776" alt="image" src="https://github.com/user-attachments/assets/50974e3a-d04d-4f49-95d2-6fd33a59ad73" />

*(Tip: You can upload a screenshot of your report to `<repository>/assets/report-preview.png` and uncomment the line below for maximum portfolio impact!)*
<!-- ![HTML Dashboard Preview](assets/report-preview.png) -->

<table>
<tr>
<td width="50%">

### Hero Banner
- 🟢 Pass rate percentage ring (animated)
- Status: HEALTHY / WARNING / CRITICAL  
- Test metadata (profile, duration, target)
<img width="1439" height="778" alt="image" src="https://github.com/user-attachments/assets/2ff13f6f-bafd-41f4-8a97-47801a763b56" />

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

The project is modularized into core runners, configurations, test scripts, and utility modules (for Grafana, Prometheus, and multi-channel notifications) to maintain enterprise-grade scalability and maintainability.

---

## ⚙️ Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| **Node.js** | v18+ | ✅ Yes |
| **K6 CLI** | Latest | ✅ Yes |
| **Prometheus** | Latest | ❌ Optional |
| **Grafana** | Latest | ❌ Optional |

### Install K6

K6 can be seamlessly installed across macOS, Windows, and Linux operating systems via their respective standard package managers (`brew`, `choco`, `apt`).

---

## 🚀 Quick Start

1. Install framework dependencies via standard npm commands.
2. Configure your specific target URL and variables in the `.env` file.
3. Automatically execute the test suites against various load profiles (e.g., `smoke`, `stress`) using the start scripts.
4. Easily view the aggregated HTML test report generated upon the run's completion.

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

All threshold values are centrally defined in a configuration JSON, allowing you to finely tune performance limits—such as maximum P50/P90/P95/P99 response times, error rate limits, and minimum throughput validations—across specific alerting severity levels (`warning` and `critical`).

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

## 🔔 Notifications & CI/CD

### Supported Channels
| Platform | Format |
|----------|--------|
| **Slack** | Rich blocks + action buttons |
| **Discord** | Embeds + role mentions |
| **MS Teams** | Adaptive cards |
| **Email** | SendGrid HTML template |

### GitHub Actions
The pipeline (`.github/workflows/performance-test.yml`) supports:
- ⚡ **Manual trigger** — select profile via GitHub UI
- ⏰ **Scheduled runs** — daily automated monitoring
- 🔄 **Push triggers** — auto-run on `main` branch changes
- 📊 **Baseline comparison** — detects regressions automatically
- 📦 **Artifact storage** — report retention

---

## 🎯 CLI Reference

The built-in command-line abstraction provides simple flags to dynamically dictate workload profiles, reuse specific existing testing results without rerunning K6 engines, or simply run a configuration validation check.

---

## 📊 Example Output

```text
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

Because scripts are compartmentalized and intelligently grouped, you can effortlessly introduce specific HTTP verbs, add new complex custom endpoints, and append data-specific schema checks inside the existing scenarios without touching the core validation engine.

---

## 🤝 Let's Connect!

I am an experienced **Quality Assurance Engineer** passionate about building robust testing infrastructure and implementing smart automation. 

- **GitHub:** [@adityadwic](https://github.com/adityadwic)
- *(Feel free to add your LinkedIn or Portfolio link here)*

If you find this project interesting, feel free to **fork it**, **star it ⭐**, or reach out to discuss QA engineering best practices!

---

<p align="center">
  Built with ❤️ by Aditya Dwi Cahyono for the QA Engineering Community
</p>
