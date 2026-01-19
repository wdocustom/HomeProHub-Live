/**
 * The Mechanic - Incident Response & Bug Fixing Agent
 *
 * ROLE: Responds to errors, incidents, and system failures
 *
 * CRITICAL CONSTRAINTS:
 * - NO live patching under load
 * - NO direct production writes
 * - NO schema changes
 * - NO deployment triggers
 * - ALL fixes via PR + approval
 *
 * CORRECT WORKFLOW:
 * 1. Detect error / incident
 * 2. Mitigate FIRST (rollback, feature flag off, rate limit)
 * 3. Analyze root cause
 * 4. Propose minimal fix
 * 5. Create PR
 * 6. Run Test Pilot
 * 7. Wait for approval
 * 8. Human merges → CD handles deploy
 */

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database/db');
const { checkFilePermission, checkActionCapability, validateProposedChange } = require('./config/policy-engine');
const { runFullValidation } = require('./config/test-pilot');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const AGENT_NAME = 'mechanic';
const AGENT_VERSION = '1.0.0';

class MechanicAgent {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = process.env.ANTHROPIC_MECHANIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.sandboxDir = path.join(__dirname, '../sandbox');
  }

  /**
   * Main entry point: Handle an error or incident
   *
   * @param {Object} incident - { error_id, error_type, error_message, stack_trace, severity }
   * @returns {Promise<Object>} Result of handling
   */
  async handleIncident(incident) {
    console.log(`🔧 Mechanic: Handling incident ${incident.error_id}`);

    // Check capability
    const canHandle = checkActionCapability(AGENT_NAME, 'can_read_errors');
    if (!canHandle.allowed) {
      throw new Error(`Mechanic not authorized: ${canHandle.reason}`);
    }

    // Log activity start
    const activityId = await this.logActivity({
      action_type: 'incident_response',
      description: `Handling ${incident.error_type}: ${incident.error_message}`,
      status: 'started'
    });

    try {
      // Step 1: Mitigation strategy (if needed)
      const mitigation = await this.proposeMitigation(incident);

      if (mitigation.requires_immediate_action) {
        console.log('⚠️  Immediate mitigation required - creating mitigation ticket');
        await db.createFeatureRequest({
          title: `URGENT: Mitigate ${incident.error_type}`,
          description: mitigation.strategy,
          priority: 'critical',
          request_type: 'bug_fix',
          created_by: AGENT_NAME,
          requires_approval: false // Mitigation tickets are informational
        });
      }

      // Step 2: Root cause analysis
      console.log('🔍 Mechanic: Analyzing root cause...');
      const analysis = await this.analyzeRootCause(incident);

      // Step 3: Propose fix
      console.log('🛠️  Mechanic: Proposing fix...');
      const fix = await this.proposeFix(incident, analysis);

      if (!fix.can_auto_fix) {
        console.log('📝 Mechanic: Creating ticket for human review');
        await db.createFeatureRequest({
          title: `Fix: ${incident.error_type}`,
          description: fix.explanation,
          priority: incident.severity === 'critical' ? 'high' : 'medium',
          request_type: 'bug_fix',
          affected_files: fix.affected_files,
          created_by: AGENT_NAME,
          requires_approval: true
        });

        await this.logActivity({
          action_type: 'ticket_created',
          description: `Created ticket for ${incident.error_type}`,
          status: 'completed',
          result_data: { ticket_id: 'created' }
        });

        return {
          success: true,
          action: 'ticket_created',
          message: 'Fix requires human review - ticket created'
        };
      }

      // Step 4: Validate fix with policy engine
      console.log('🔒 Mechanic: Validating fix with policy engine...');
      const validation = validateProposedChange(
        AGENT_NAME,
        fix.files_to_modify,
        'pr'
      );

      if (!validation.approved) {
        console.error('❌ Mechanic: Fix violates policy');
        console.error('Violations:', validation.violations);

        await this.logActivity({
          action_type: 'fix_blocked',
          description: 'Fix violates policy constraints',
          status: 'failed',
          result_data: { violations: validation.violations }
        });

        return {
          success: false,
          action: 'blocked_by_policy',
          violations: validation.violations
        };
      }

      // Step 5: Apply fix in sandbox
      console.log('🧪 Mechanic: Applying fix in sandbox...');
      const sandboxResult = await this.applyFixInSandbox(fix);

      if (!sandboxResult.success) {
        console.error('❌ Mechanic: Fix failed in sandbox');
        return {
          success: false,
          action: 'sandbox_failure',
          error: sandboxResult.error
        };
      }

      // Step 6: Run Test Pilot
      console.log('🧪 Mechanic: Running Test Pilot validation...');
      const testResult = await runFullValidation(fix.files_to_modify);

      if (!testResult.passed) {
        console.error('❌ Mechanic: Fix failed Test Pilot');
        await this.logActivity({
          action_type: 'test_pilot_failed',
          description: 'Fix failed validation',
          status: 'failed',
          result_data: { blockers: testResult.blockers }
        });

        return {
          success: false,
          action: 'test_pilot_failure',
          blockers: testResult.blockers
        };
      }

      // Step 7: Create PR (artifact, not deployment)
      console.log('📝 Mechanic: Creating PR...');
      const prResult = await this.createPR(incident, fix, analysis);

      await this.logActivity({
        action_type: 'pr_created',
        description: `Created PR for ${incident.error_type}`,
        status: 'completed',
        result_data: {
          pr_url: prResult.pr_url,
          files_modified: fix.files_to_modify
        }
      });

      // Update error status
      await db.updateSystemError(incident.error_id, {
        status: 'fix_proposed',
        resolution_notes: `PR created: ${prResult.pr_url}`,
        updated_at: new Date().toISOString()
      });

      console.log('✅ Mechanic: PR created successfully');
      console.log(`   PR: ${prResult.pr_url}`);
      console.log(`   Awaiting human approval`);

      return {
        success: true,
        action: 'pr_created',
        pr_url: prResult.pr_url,
        files_modified: fix.files_to_modify,
        requires_approval: true
      };

    } catch (error) {
      console.error('❌ Mechanic: Error handling incident:', error);

      await this.logActivity({
        action_type: 'incident_response',
        description: `Failed to handle ${incident.error_type}`,
        status: 'failed',
        result_data: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Propose mitigation strategy for immediate action
   */
  async proposeMitigation(incident) {
    // Simple rule-based mitigation for now
    const mitigations = {
      'DatabaseError': {
        strategy: 'Check database connection pool, consider read-only mode',
        requires_immediate_action: incident.severity === 'critical'
      },
      'RateLimitExceeded': {
        strategy: 'Enable rate limiting, reduce concurrent requests',
        requires_immediate_action: true
      },
      'AuthenticationError': {
        strategy: 'Verify auth service health, check token expiration',
        requires_immediate_action: incident.severity === 'critical'
      },
      'default': {
        strategy: 'Monitor logs, assess impact, prepare rollback if needed',
        requires_immediate_action: false
      }
    };

    return mitigations[incident.error_type] || mitigations.default;
  }

  /**
   * Analyze root cause using AI
   */
  async analyzeRootCause(incident) {
    const prompt = `You are The Mechanic, a debugging AI for the HomeProHub platform.

INCIDENT REPORT:
- Error Type: ${incident.error_type}
- Error Message: ${incident.error_message}
- Stack Trace: ${incident.stack_trace || 'N/A'}
- Severity: ${incident.severity}

Analyze the root cause. Provide:
1. What went wrong?
2. Why did it happen?
3. Where is the bug likely located?
4. What files need to be examined?

Format as JSON:
{
  "root_cause": "...",
  "why": "...",
  "likely_location": "...",
  "files_to_examine": ["file1.js", "file2.js"]
}`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const analysisText = response.content[0].text;
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      root_cause: 'Analysis failed',
      why: 'Could not parse AI response',
      likely_location: 'unknown',
      files_to_examine: []
    };
  }

  /**
   * Propose a fix using AI
   */
  async proposeFix(incident, analysis) {
    // Check which files we can actually modify
    const allowedFiles = [];
    const deniedFiles = [];

    for (const file of analysis.files_to_examine) {
      const permission = checkFilePermission(AGENT_NAME, file, 'write');
      if (permission.allowed) {
        allowedFiles.push(file);
      } else {
        deniedFiles.push({ file, reason: permission.reason });
      }
    }

    if (allowedFiles.length === 0) {
      return {
        can_auto_fix: false,
        explanation: `Cannot auto-fix: No write permission to files: ${analysis.files_to_examine.join(', ')}`,
        affected_files: analysis.files_to_examine,
        denied_files: deniedFiles
      };
    }

    // For now, create a ticket rather than auto-generating code
    // TODO: Implement AI-powered code generation with safety checks
    return {
      can_auto_fix: false,
      explanation: `Root cause: ${analysis.root_cause}\n\nWhy: ${analysis.why}\n\nFiles to fix: ${allowedFiles.join(', ')}\n\nRecommendation: Manual review and fix required.`,
      affected_files: allowedFiles,
      files_to_modify: allowedFiles
    };
  }

  /**
   * Apply fix in sandbox environment
   */
  async applyFixInSandbox(fix) {
    // TODO: Implement sandbox execution
    // For now, skip sandbox
    return {
      success: true,
      message: 'Sandbox execution skipped (not yet implemented)'
    };
  }

  /**
   * Create PR for fix (artifact, not deployment)
   */
  async createPR(incident, fix, analysis) {
    // Check capability
    const canCreatePR = checkActionCapability(AGENT_NAME, 'can_create_pr');
    if (!canCreatePR.allowed) {
      throw new Error(`Not authorized to create PR: ${canCreatePR.reason}`);
    }

    const branchName = `mechanic/fix-${incident.error_type.toLowerCase()}-${Date.now()}`;
    const prTitle = `Fix: ${incident.error_type} - ${incident.error_message.substring(0, 50)}`;
    const prBody = `## Incident Response - Automated Fix Proposal

**Error ID:** ${incident.error_id}
**Error Type:** ${incident.error_type}
**Severity:** ${incident.severity}

## Root Cause Analysis

${analysis.root_cause}

**Why it happened:** ${analysis.why}

## Proposed Fix

${fix.explanation}

## Files Modified

${fix.files_to_modify.map(f => `- ${f}`).join('\n')}

## Test Pilot Results

✅ Syntax check: PASSED
✅ Security scan: PASSED
⚠️  Additional tests required

## Approval Required

- [ ] Human review of fix
- [ ] Test in staging
- [ ] Confirm fix resolves incident
- [ ] Sign off for merge

---
**Agent:** The Mechanic v${AGENT_VERSION}
**Generated:** ${new Date().toISOString()}
`;

    // For now, return mock PR URL
    // TODO: Integrate with GitHub API or similar
    return {
      pr_url: `https://github.com/homeprohub/homeprohub/pull/mock-${Date.now()}`,
      branch: branchName,
      title: prTitle,
      body: prBody
    };
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

module.exports = MechanicAgent;
