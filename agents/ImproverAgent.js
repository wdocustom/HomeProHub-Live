/**
 * The Improver - SRE-Oriented Code Quality Agent
 *
 * ROLE: Proactively identifies issues and creates improvement tickets
 *
 * CRITICAL CONSTRAINTS:
 * - NEVER writes code directly
 * - ONLY creates tickets for Builder
 * - Must be metrics-based triggers ONLY
 * - NO random file scanning
 * - NO subjective refactors
 * - NO cosmetic-only tickets
 *
 * ALLOWED SIGNALS:
 * - Latency regressions
 * - Error hotspots
 * - Lighthouse/accessibility failures
 * - Bundle size growth
 * - Security warnings
 *
 * FORBIDDEN ACTIONS:
 * - Creating PRs
 * - Modifying files
 * - Deploying
 * - Running migrations
 * - Scanning without metrics
 *
 * OUTPUT:
 * Structured tickets for Builder to implement
 */

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database/db');
const { checkActionCapability, ACTION_CAPABILITIES } = require('./config/policy-engine');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const AGENT_NAME = 'improver';
const AGENT_VERSION = '1.0.0';

class ImproverAgent {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = process.env.ANTHROPIC_IMPROVER_MODEL || 'claude-3-5-sonnet-20241022';
    this.maxTicketsPerRun = ACTION_CAPABILITIES[AGENT_NAME].max_tickets_per_run;
  }

  /**
   * Main entry point: Run proactive analysis
   *
   * @param {Object} options - { trigger_type, metrics }
   * @returns {Promise<Object>} Analysis results
   */
  async runAnalysis(options = {}) {
    console.log('🔍 Improver: Running proactive analysis...');

    // Check capability
    const canCreateTickets = checkActionCapability(AGENT_NAME, 'can_create_tickets');
    if (!canCreateTickets.allowed) {
      throw new Error(`Improver not authorized: ${canCreateTickets.reason}`);
    }

    // Verify this is metrics-based, not random
    if (!options.trigger_type || !options.metrics) {
      throw new Error('Improver requires metrics-based trigger. Random scanning is forbidden.');
    }

    // Log activity start
    await this.logActivity({
      action_type: 'proactive_analysis',
      description: `Analysis triggered by: ${options.trigger_type}`,
      status: 'started'
    });

    try {
      const tickets = [];

      // Route to appropriate analysis based on trigger
      switch (options.trigger_type) {
        case 'latency_regression':
          tickets.push(...await this.analyzeLatencyRegression(options.metrics));
          break;

        case 'error_hotspot':
          tickets.push(...await this.analyzeErrorHotspot(options.metrics));
          break;

        case 'security_warning':
          tickets.push(...await this.analyzeSecurityWarning(options.metrics));
          break;

        case 'bundle_size':
          tickets.push(...await this.analyzeBundleSize(options.metrics));
          break;

        case 'accessibility':
          tickets.push(...await this.analyzeAccessibility(options.metrics));
          break;

        default:
          throw new Error(`Unknown trigger type: ${options.trigger_type}`);
      }

      // Enforce ticket limit
      if (tickets.length > this.maxTicketsPerRun) {
        console.warn(`⚠️  Improver generated ${tickets.length} tickets, limiting to ${this.maxTicketsPerRun}`);
        tickets.splice(this.maxTicketsPerRun);
      }

      // Create tickets in database
      const createdTickets = [];
      for (const ticket of tickets) {
        const created = await db.createFeatureRequest({
          title: ticket.title,
          description: ticket.description,
          priority: ticket.priority,
          request_type: 'improvement',
          affected_files: ticket.affected_files || [],
          created_by: AGENT_NAME,
          source_file: ticket.source_file || null,
          requires_approval: false // Tickets don't need approval, just creation
        });
        createdTickets.push(created);
      }

      await this.logActivity({
        action_type: 'tickets_created',
        description: `Created ${createdTickets.length} improvement tickets`,
        status: 'completed',
        result_data: {
          trigger_type: options.trigger_type,
          tickets_created: createdTickets.length
        }
      });

      console.log(`✅ Improver: Created ${createdTickets.length} improvement tickets`);

      return {
        success: true,
        action: 'tickets_created',
        tickets: createdTickets,
        trigger_type: options.trigger_type
      };

    } catch (error) {
      console.error('❌ Improver: Error during analysis:', error);

      await this.logActivity({
        action_type: 'proactive_analysis',
        description: `Failed analysis for ${options.trigger_type}`,
        status: 'failed',
        result_data: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Analyze latency regression
   */
  async analyzeLatencyRegression(metrics) {
    console.log('📊 Improver: Analyzing latency regression...');

    const tickets = [];

    if (!metrics.endpoint || !metrics.p95_latency_ms || !metrics.baseline_ms) {
      console.warn('⚠️  Insufficient latency metrics');
      return tickets;
    }

    const regression = metrics.p95_latency_ms - metrics.baseline_ms;
    const regressionPercent = (regression / metrics.baseline_ms) * 100;

    if (regressionPercent > 50) {
      tickets.push({
        title: `Performance: ${metrics.endpoint} latency increased ${regressionPercent.toFixed(0)}%`,
        description: `## Performance Regression Detected

**Endpoint:** ${metrics.endpoint}
**Current P95:** ${metrics.p95_latency_ms}ms
**Baseline:** ${metrics.baseline_ms}ms
**Regression:** +${regression}ms (+${regressionPercent.toFixed(0)}%)

## Impact
High latency affects user experience and may indicate inefficient queries, missing indexes, or resource contention.

## Recommended Actions
1. Profile the endpoint to identify bottlenecks
2. Check database query performance
3. Review recent changes to this endpoint
4. Consider caching if appropriate

## Metrics
- P95 latency: ${metrics.p95_latency_ms}ms
- Baseline: ${metrics.baseline_ms}ms
- Sample size: ${metrics.sample_size || 'unknown'}
- Detected: ${new Date().toISOString()}`,
        priority: regressionPercent > 100 ? 'high' : 'medium',
        affected_files: [metrics.endpoint_file || 'unknown'],
        source_file: metrics.endpoint_file
      });
    }

    return tickets;
  }

  /**
   * Analyze error hotspot
   */
  async analyzeErrorHotspot(metrics) {
    console.log('🔥 Improver: Analyzing error hotspot...');

    const tickets = [];

    if (!metrics.error_type || !metrics.occurrence_count) {
      console.warn('⚠️  Insufficient error metrics');
      return tickets;
    }

    if (metrics.occurrence_count > 10) {
      tickets.push({
        title: `Bug: ${metrics.error_type} occurring frequently (${metrics.occurrence_count} times)`,
        description: `## Error Hotspot Detected

**Error Type:** ${metrics.error_type}
**Occurrences:** ${metrics.occurrence_count}
**First Seen:** ${metrics.first_seen || 'unknown'}
**Last Seen:** ${metrics.last_seen || 'just now'}

## Error Message
\`\`\`
${metrics.error_message || 'N/A'}
\`\`\`

## Stack Trace
\`\`\`
${metrics.stack_trace || 'N/A'}
\`\`\`

## Impact
This error is occurring frequently and may indicate a systemic issue.

## Recommended Actions
1. Review error logs for patterns
2. Identify root cause
3. Implement fix with proper error handling
4. Add tests to prevent regression

## Metrics
- Occurrence count: ${metrics.occurrence_count}
- Error rate: ${metrics.error_rate || 'unknown'}
- Affected users: ${metrics.affected_users || 'unknown'}`,
        priority: metrics.occurrence_count > 50 ? 'high' : 'medium',
        affected_files: metrics.affected_files || [],
        source_file: metrics.source_file
      });
    }

    return tickets;
  }

  /**
   * Analyze security warning
   */
  async analyzeSecurityWarning(metrics) {
    console.log('🔒 Improver: Analyzing security warning...');

    const tickets = [];

    if (!metrics.vulnerability_type) {
      console.warn('⚠️  Insufficient security metrics');
      return tickets;
    }

    tickets.push({
      title: `Security: ${metrics.vulnerability_type} detected`,
      description: `## Security Warning

**Vulnerability Type:** ${metrics.vulnerability_type}
**Severity:** ${metrics.severity || 'unknown'}
**Package:** ${metrics.package_name || 'N/A'}
**Affected Version:** ${metrics.affected_version || 'N/A'}

## Details
${metrics.description || 'No additional details provided.'}

## Recommended Actions
1. Review the vulnerability details
2. Update affected packages if available
3. Implement workarounds if no patch available
4. Add security tests

## References
${metrics.references ? metrics.references.map(r => `- ${r}`).join('\n') : 'None'}

## Detected
${new Date().toISOString()}`,
      priority: metrics.severity === 'critical' ? 'critical' : 'high',
      affected_files: metrics.affected_files || [],
      source_file: metrics.source_file
    });

    return tickets;
  }

  /**
   * Analyze bundle size growth
   */
  async analyzeBundleSize(metrics) {
    console.log('📦 Improver: Analyzing bundle size...');

    const tickets = [];

    if (!metrics.current_size_kb || !metrics.baseline_size_kb) {
      console.warn('⚠️  Insufficient bundle size metrics');
      return tickets;
    }

    const growth = metrics.current_size_kb - metrics.baseline_size_kb;
    const growthPercent = (growth / metrics.baseline_size_kb) * 100;

    if (growthPercent > 20) {
      tickets.push({
        title: `Performance: Bundle size increased ${growthPercent.toFixed(0)}% (${growth}KB)`,
        description: `## Bundle Size Growth Detected

**Current Size:** ${metrics.current_size_kb}KB
**Baseline Size:** ${metrics.baseline_size_kb}KB
**Growth:** +${growth}KB (+${growthPercent.toFixed(0)}%)

## Impact
Large bundles increase page load time and affect user experience, especially on slow connections.

## Recommended Actions
1. Analyze bundle composition to identify large dependencies
2. Implement code splitting for large features
3. Remove unused dependencies
4. Enable tree shaking and minification
5. Consider lazy loading for non-critical code

## Metrics
- Current size: ${metrics.current_size_kb}KB
- Baseline: ${metrics.baseline_size_kb}KB
- Growth: +${growth}KB
- Detected: ${new Date().toISOString()}`,
        priority: growthPercent > 50 ? 'high' : 'medium',
        affected_files: ['public/**/*.js'],
        source_file: null
      });
    }

    return tickets;
  }

  /**
   * Analyze accessibility issues
   */
  async analyzeAccessibility(metrics) {
    console.log('♿ Improver: Analyzing accessibility...');

    const tickets = [];

    if (!metrics.issues || metrics.issues.length === 0) {
      console.log('✅ No accessibility issues detected');
      return tickets;
    }

    // Group issues by severity
    const critical = metrics.issues.filter(i => i.severity === 'critical');
    const high = metrics.issues.filter(i => i.severity === 'high');

    if (critical.length > 0) {
      tickets.push({
        title: `Accessibility: ${critical.length} critical issues detected`,
        description: `## Critical Accessibility Issues

**Issues Found:** ${critical.length}
**Page:** ${metrics.page || 'unknown'}

## Issues
${critical.map((issue, i) => `
### ${i + 1}. ${issue.type}
- **Element:** ${issue.element || 'N/A'}
- **Issue:** ${issue.description}
- **WCAG:** ${issue.wcag_criterion || 'N/A'}
- **Fix:** ${issue.recommended_fix || 'See WCAG guidelines'}
`).join('\n')}

## Impact
Accessibility issues prevent users with disabilities from using the platform effectively.

## Recommended Actions
1. Fix critical issues first
2. Add aria labels and roles where needed
3. Ensure keyboard navigation works
4. Test with screen readers
5. Add accessibility tests to prevent regression

## Detected
${new Date().toISOString()}`,
        priority: 'high',
        affected_files: [metrics.file_path || 'unknown'],
        source_file: metrics.file_path
      });
    }

    return tickets;
  }

  /**
   * Log agent activity
   */
  async logActivity(activity) {
    return await db.logAgentActivity({
      agent_name: AGENT_NAME,
      action_type: activity.action_type,
      description: activity.description,
      status: activity.status,
      result_data: activity.result_data || {},
      started_at: new Date().toISOString(),
      completed_at: activity.status === 'completed' ? new Date().toISOString() : null
    });
  }
}

module.exports = ImproverAgent;
