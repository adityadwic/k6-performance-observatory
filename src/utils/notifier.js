const axios = require('axios');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'sendgrid';
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@performance-qa.com';
const EMAIL_TO = process.env.EMAIL_TO?.split(',') || [];

/**
 * Send notification to configured channels
 * @param {Array} validationResults - Array of validation results
 * @param {string} reportUrl - URL to the HTML report
 * @param {object} metadata - Additional metadata (profile, duration, etc.)
 */
async function sendNotification(validationResults, reportUrl = '', metadata = {}) {
    const failed = validationResults.filter(r => !r.passed);
    const passed = validationResults.filter(r => r.passed);
    const statusText = failed.length === 0 ? '✅ PASSED' : '❌ FAILED';
    const severity = getSeverity(failed, metadata.slaConfig?.alerts);

    // Send to webhook (Slack/Discord/Teams)
    if (WEBHOOK_URL) {
        await sendWebhookNotification(validationResults, reportUrl, metadata, severity);
    }

    // Send email notification
    if (EMAIL_ENABLED && EMAIL_API_KEY && EMAIL_TO.length > 0) {
        await sendEmailNotification(validationResults, reportUrl, metadata, severity);
    }

    console.log(`[Notifier] 🔔 Notifications sent: Webhook=${!!WEBHOOK_URL}, Email=${EMAIL_ENABLED && EMAIL_TO.length > 0}`);
}

/**
 * Determine severity level based on failures
 */
function getSeverity(failed, alertThresholds) {
    if (failed.length === 0) return 'success';

    const criticalThresholds = alertThresholds?.critical || {};
    const warningThresholds = alertThresholds?.warning || {};

    for (const failure of failed) {
        const actual = parseFloat(failure.actual);

        if (failure.metric.includes('Response Time') && criticalThresholds.p95_response_time_ms) {
            if (actual >= criticalThresholds.p95_response_time_ms) return 'critical';
        }
        if (failure.metric.includes('Error Rate') && criticalThresholds.max_error_rate_percent) {
            if (actual >= criticalThresholds.max_error_rate_percent) return 'critical';
        }
    }

    return failed.length > 1 ? 'warning' : 'info';
}

/**
 * Send rich Slack notification with blocks
 */
async function sendSlackNotification(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);
    const passed = validationResults.filter(r => r.passed);

    const colorMap = {
        success: 'good',
        info: 'good',
        warning: 'warning',
        critical: 'danger'
    };

    const emojiMap = {
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨'
    };

    const blocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${emojiMap[severity]} Performance Test ${severity.toUpperCase()}`,
                emoji: true
            }
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `*Profile:* ${metadata.profile || 'default'} | *Duration:* ${metadata.duration || 'N/A'} | *Target:* ${metadata.targetUrl || 'N/A'}`
                }
            ]
        },
        {
            type: 'divider'
        }
    ];

    // Summary section
    blocks.push({
        type: 'section',
        fields: [
            {
                type: 'mrkdwn',
                text: `*Passed Checks:*\n${passed.length} ✅`
            },
            {
                type: 'mrkdwn',
                text: `*Failed Checks:*\n${failed.length} ${failed.length > 0 ? '❌' : '✅'}`
            }
        ]
    });

    // Failed checks details
    if (failed.length > 0) {
        const failedText = failed.map(f =>
            `• *${f.metric}*: ${f.actual} (threshold: ${f.threshold})`
        ).join('\n');

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*❌ Failed SLAs:*\n${failedText}`
            }
        });
    }

    // All metrics summary
    const allMetricsText = validationResults.map(r =>
        `${r.passed ? '✅' : '❌'} ${r.metric}: ${r.actual}`
    ).join('\n');

    blocks.push({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `*📊 All Metrics:*\n\`\`\`${allMetricsText}\`\`\``
        }
    });

    // Action buttons
    if (reportUrl) {
        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: '📈 View Full Report',
                        emoji: true
                    },
                    url: reportUrl
                }
            ]
        });
    }

    // Timestamp
    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: `⏰ ${new Date().toLocaleString()} | Performance Observability Framework`
            }
        ]
    });

    try {
        await axios.post(WEBHOOK_URL, {
            attachments: [{
                color: colorMap[severity],
                blocks: blocks
            }]
        });
        console.log('[Notifier] ✅ Slack notification sent');
    } catch (error) {
        console.error(`[Notifier] Failed to send Slack notification: ${error.message}`);
    }
}

/**
 * Send Discord notification with embeds
 */
async function sendDiscordNotification(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);

    const colorMap = {
        success: 5763719,    // Green
        info: 3447003,       // Blue
        warning: 16776960,   // Yellow
        critical: 15548997   // Red
    };

    const emojiMap = {
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨'
    };

    const fields = validationResults.map(r => ({
        name: `${r.passed ? '✅' : '❌'} ${r.metric}`,
        value: `Actual: **${r.actual}**\nThreshold: ${r.threshold}`,
        inline: true
    }));

    const embed = {
        title: `${emojiMap[severity]} Performance Test ${severity.toUpperCase()}`,
        description: `**Profile:** ${metadata.profile || 'default'}\n**Target:** ${metadata.targetUrl || 'N/A'}`,
        color: colorMap[severity],
        fields: fields,
        footer: {
            text: 'Performance Observability Framework',
            icon_url: 'https://grafana.com/static/img/menu/grafana2.svg'
        },
        timestamp: new Date().toISOString()
    };

    if (reportUrl) {
        embed.url = reportUrl;
    }

    try {
        await axios.post(WEBHOOK_URL, {
            embeds: [embed],
            content: failed.length > 0 ? `<@&${process.env.DISCORD_ROLE_ID || ''}> SLA Violations Detected!` : ''
        });
        console.log('[Notifier] ✅ Discord notification sent');
    } catch (error) {
        console.error(`[Notifier] Failed to send Discord notification: ${error.message}`);
    }
}

/**
 * Generic webhook notification (auto-detect platform)
 */
async function sendWebhookNotification(validationResults, reportUrl, metadata, severity) {
    // Try to detect platform from URL
    const isSlack = WEBHOOK_URL.includes('slack.com');
    const isDiscord = WEBHOOK_URL.includes('discord.com') || WEBHOOK_URL.includes('discordapp.com');
    const isTeams = WEBHOOK_URL.includes('office.com') || WEBHOOK_URL.includes('webhook.office.com');

    if (isSlack) {
        await sendSlackNotification(validationResults, reportUrl, metadata, severity);
    } else if (isDiscord) {
        await sendDiscordNotification(validationResults, reportUrl, metadata, severity);
    } else if (isTeams) {
        await sendTeamsNotification(validationResults, reportUrl, metadata, severity);
    } else {
        // Generic fallback
        await sendGenericWebhook(validationResults, reportUrl, metadata, severity);
    }
}

/**
 * Microsoft Teams notification
 */
async function sendTeamsNotification(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);

    const emojiMap = {
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨'
    };

    const facts = validationResults.map(r => ({
        name: r.metric,
        value: `${r.actual} ${r.passed ? '✅' : '❌'}`
    }));

    const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: severity === 'critical' ? 'FF0000' : severity === 'warning' ? 'FFA500' : '00FF00',
        summary: `Performance Test ${severity}`,
        sections: [{
            activityTitle: `${emojiMap[severity]} Performance Test ${severity.toUpperCase()}`,
            activitySubtitle: `Profile: ${metadata.profile || 'default'} | Target: ${metadata.targetUrl || 'N/A'}`,
            facts: facts,
            markdown: true
        }]
    };

    if (reportUrl) {
        card.sections[0].potentialAction = [{
            '@type': 'OpenUri',
            name: 'View Report',
            targets: [{ os: 'default', uri: reportUrl }]
        }];
    }

    try {
        await axios.post(WEBHOOK_URL, card);
        console.log('[Notifier] ✅ Teams notification sent');
    } catch (error) {
        console.error(`[Notifier] Failed to send Teams notification: ${error.message}`);
    }
}

/**
 * Generic webhook fallback
 */
async function sendGenericWebhook(validationResults, reportUrl, metadata, severity) {
    const payload = {
        severity: severity,
        timestamp: new Date().toISOString(),
        profile: metadata.profile,
        targetUrl: metadata.targetUrl,
        reportUrl: reportUrl,
        results: validationResults,
        summary: {
            passed: validationResults.filter(r => r.passed).length,
            failed: validationResults.filter(r => !r.passed).length,
            total: validationResults.length
        }
    };

    try {
        await axios.post(WEBHOOK_URL, payload);
        console.log('[Notifier] ✅ Generic webhook notification sent');
    } catch (error) {
        console.error(`[Notifier] Failed to send webhook notification: ${error.message}`);
    }
}

/**
 * Send email notification via SendGrid
 */
async function sendEmailNotification(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);

    const emojiMap = {
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨'
    };

    const subject = `${emojiMap[severity]} Performance Test ${severity.toUpperCase()} - ${metadata.profile || 'default'}`;

    // Build HTML email body
    const emailHtml = buildEmailHtml(validationResults, reportUrl, metadata, severity);

    const emailPayload = {
        personalizations: EMAIL_TO.map(email => ({ to: [{ email }] })),
        from: { email: EMAIL_FROM },
        subject: subject,
        content: [
            { type: 'text/plain', value: buildEmailText(validationResults, reportUrl, metadata, severity) },
            { type: 'text/html', value: emailHtml }
        ]
    };

    try {
        const response = await axios.post('https://api.sendgrid.com/v3/mail/send', emailPayload, {
            headers: {
                'Authorization': `Bearer ${EMAIL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[Notifier] ✅ Email notification sent');
    } catch (error) {
        console.error(`[Notifier] Failed to send email: ${error.message}`);
    }
}

/**
 * Build HTML email body
 */
function buildEmailHtml(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);
    const passed = validationResults.filter(r => r.passed);

    const colorMap = {
        success: '#28a745',
        info: '#17a2b8',
        warning: '#ffc107',
        critical: '#dc3545'
    };

    const bgMap = {
        success: '#d4edda',
        info: '#d1ecf1',
        warning: '#fff3cd',
        critical: '#f8d7da'
    };

    // Generate Dynamic Executive Summary for Email
    let summaryInsightText = '';
    const passRate = ((passed.length / validationResults.length) * 100).toFixed(0);
    if (failed.length === 0) {
        summaryInsightText = `Optimal System Health: The ${metadata.profile?.toUpperCase() || 'DEFAULT'} load profile executed successfully with a 100% pass rate. All ${validationResults.length} SLA metrics are well within acceptable boundary limits.`;
    } else {
        const failedMetrics = failed.map(f => f.metric).join(', ');
        summaryInsightText = `Performance Degradation Detected: The ${metadata.profile?.toUpperCase() || 'DEFAULT'} load profile resulted in ${failed.length} SLA violations (${passRate}% pass rate). Critical impact observed in: ${failedMetrics}. Immediate action or scaling evaluation is recommended.`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e1e2f 0%, #2d2b42 100%); padding: 30px; text-align: center; border-bottom: 4px solid ${colorMap[severity]};">
            <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Performance Observability Report</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0; font-size: 14px;">${new Date().toLocaleString()}</p>
        </div>
        
        <!-- Executive Summary Banner -->
        <div style="background: ${failed.length === 0 ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-left: 4px solid ${colorMap[severity]}; margin: 20px;">
            <h3 style="margin: 0 0 8px 0; color: ${failed.length === 0 ? '#166534' : '#991b1b'}; font-size: 16px;">💡 Executive Summary</h3>
            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${summaryInsightText}</p>
        </div>
        
        <!-- Metadata Grid -->
        <div style="padding: 0 20px 20px 20px;">
            <div style="display: table; width: 100%; border-collapse: separate; border-spacing: 12px 0;">
                <div style="display: table-cell; width: 33%; background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Profile</div>
                    <div style="font-size: 16px; color: #0f172a; font-weight: 700;">${metadata.profile?.toUpperCase() || 'DEFAULT'}</div>
                </div>
                <div style="display: table-cell; width: 33%; background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Pass Rate</div>
                    <div style="font-size: 16px; color: ${colorMap[severity]}; font-weight: 700;">${passRate}%</div>
                </div>
                <div style="display: table-cell; width: 33%; background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Duration</div>
                    <div style="font-size: 16px; color: #0f172a; font-weight: 700;">${metadata.duration || 'N/A'}</div>
                </div>
            </div>
            
            <div style="margin-top: 12px; background: #f8fafc; padding: 12px 15px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
                <span style="color: #64748b; font-weight: 600;">🎯 Target URI:</span> <span style="color: #0f172a; word-break: break-all;">${metadata.targetUrl || 'N/A'}</span>
            </div>
        </div>
        
        <!-- Detailed Results Table -->
        <div style="padding: 0 20px 20px 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📊 SLA Checklist Matrix</h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr>
                        <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; width: 45%;">Metric</th>
                        <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; text-align: right;">Actual</th>
                        <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; text-align: right;">SLA</th>
                        <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 600; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${validationResults.map(r => `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 500;">${r.metric}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-size: 14px; color: #334155;">${r.actual}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-size: 14px; color: #94a3b8;">${r.threshold.replace('<=', '≤').replace('>=', '≥')}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${r.passed ? '#dcfce7' : '#fee2e2'}; color: ${r.passed ? '#15803d' : '#b91c1c'}; letter-spacing: 0.5px;">
                                ${r.passed ? 'PASS' : 'FAIL'}
                            </span>
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Action Button & Footer -->
        <div style="background: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            ${reportUrl ? `
            <a href="${reportUrl}" style="display: inline-block; margin-bottom: 25px; padding: 14px 32px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                View Full HTML Report
            </a>
            ` : ''}
            <div style="color: #64748b; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0; font-weight: 600;">Performance & Observability Validation Framework</p>
                <p style="margin: 4px 0 0 0;">Automated Quality Assurance Pipeline</p>
            </div>
        </div>
        
    </div>
</body>
</html>
    `;
}

/**
 * Build plain text email body
 */
function buildEmailText(validationResults, reportUrl, metadata, severity) {
    const failed = validationResults.filter(r => !r.passed);

    let text = `Performance Test Report\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Status: ${severity.toUpperCase()}\n`;
    text += `Profile: ${metadata.profile || 'default'}\n`;
    text += `Target: ${metadata.targetUrl || 'N/A'}\n`;
    text += `Time: ${new Date().toLocaleString()}\n\n`;
    text += `Results:\n${'-'.repeat(50)}\n`;

    validationResults.forEach(r => {
        text += `${r.passed ? '✅' : '❌'} ${r.metric}: ${r.actual} (threshold: ${r.threshold})\n`;
    });

    if (reportUrl) {
        text += `\nView Report: ${reportUrl}\n`;
    }

    return text;
}

module.exports = {
    sendNotification,
    sendSlackNotification,
    sendDiscordNotification,
    sendTeamsNotification,
    sendEmailNotification
};