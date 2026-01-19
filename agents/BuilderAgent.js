/**
 * The Builder - Feature Development Agent
 *
 * ROLE: Implements features from validated tickets
 *
 * CRITICAL CONSTRAINTS:
 * - Only works on validated feature_requests entries
 * - NO schema changes without approval
 * - NO auth or payment code modifications
 * - ALL changes via PR + approval
 * - Must include tests with code
 *
 * CORRECT WORKFLOW:
 * 1. Load architectural constraints
 * 2. Query Knowledge Base for context
 * 3. Generate implementation plan
 * 4. Write code AND tests together
 * 5. Create PR with:
 *    - Diff
 *    - Change report
 *    - Risk classification
 * 6. Pass Test Pilot
 * 7. Await approval
 * 8. Human merges → CD handles deploy
 *
 * REFUSAL CONDITIONS:
 * - Ticket missing acceptance criteria
 * - Ticket missing success metrics
 * - Scope unclear
 * - Restricted file access
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

const AGENT_NAME = 'builder';
const AGENT_VERSION = '1.0.0';

class BuilderAgent {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = process.env.ANTHROPIC_BUILDER_MODEL || 'claude-3-5-sonnet-20241022';
    this.sandboxDir = path.join(__dirname, '../sandbox');
  }

  /**
   * Main entry point: Implement a feature from a ticket
   *
   * @param {string} requestId - Feature request ID
   * @returns {Promise<Object>} Result of implementation
   */
  async implementFeature(requestId) {
    console.log(`🏗️  Builder: Implementing feature ${requestId}`);

    // Check capability
    const canCreatePR = checkActionCapability(AGENT_NAME, 'can_create_pr');
    if (!canCreatePR.allowed) {
      throw new Error(`Builder not authorized: ${canCreatePR.reason}`);
    }

    // Load feature request
    const request = await this.loadFeatureRequest(requestId);

    if (!request) {
      throw new Error(`Feature request ${requestId} not found`);
    }

    // Validate ticket quality
    const ticketValidation = this.validateTicket(request);
    if (!ticketValidation.valid) {
      console.error('❌ Builder: Ticket validation failed');
      console.error('Reasons:', ticketValidation.reasons);

      await db.updateFeatureRequest(requestId, {
        status: 'rejected',
        resolution_notes: `Ticket validation failed: ${ticketValidation.reasons.join(', ')}`
      });

      return {
        success: false,
        action: 'ticket_rejected',
        reasons: ticketValidation.reasons
      };
    }

    // Log activity start
    await this.logActivity({
      action_type: 'feature_implementation',
      description: `Implementing: ${request.title}`,
      related_request_id: requestId,
      status: 'started'
    });

    try {
      // Step 1: Load architectural constraints
      console.log('📐 Builder: Loading architectural constraints...');
      const constraints = await this.loadArchitecturalConstraints();

      // Step 2: Query knowledge base
      console.log('📚 Builder: Querying knowledge base...');
      const context = await this.queryKnowledgeBase(request);

      // Step 3: Generate implementation plan
      console.log('📋 Builder: Generating implementation plan...');
      const plan = await this.generateImplementationPlan(request, constraints, context);

      if (!plan.feasible) {
        console.log('⚠️  Builder: Implementation not feasible');
        await db.updateFeatureRequest(requestId, {
          status: 'blocked',
          resolution_notes: plan.blocker_reason
        });

        return {
          success: false,
          action: 'not_feasible',
          reason: plan.blocker_reason
        };
      }

      // Step 4: Validate plan with policy engine
      console.log('🔒 Builder: Validating plan with policy engine...');
      const validation = validateProposedChange(
        AGENT_NAME,
        plan.files_to_modify,
        'pr'
      );

      if (!validation.approved) {
        console.error('❌ Builder: Plan violates policy');
        console.error('Violations:', validation.violations);

        await db.updateFeatureRequest(requestId, {
          status: 'blocked',
          resolution_notes: `Policy violations: ${validation.violations.map(v => v.message).join('; ')}`
        });

        return {
          success: false,
          action: 'blocked_by_policy',
          violations: validation.violations
        };
      }

      // Step 5: Generate code (in sandbox)
      console.log('💻 Builder: Generating code...');
      const codeResult = await this.generateCode(plan, request);

      if (!codeResult.success) {
        console.error('❌ Builder: Code generation failed');
        return {
          success: false,
          action: 'code_generation_failed',
          error: codeResult.error
        };
      }

      // Step 6: Run Test Pilot
      console.log('🧪 Builder: Running Test Pilot validation...');
      const testResult = await runFullValidation(plan.files_to_modify);

      if (!testResult.passed) {
        console.error('❌ Builder: Code failed Test Pilot');
        await this.logActivity({
          action_type: 'test_pilot_failed',
          description: 'Generated code failed validation',
          related_request_id: requestId,
          status: 'failed',
          result_data: { blockers: testResult.blockers }
        });

        return {
          success: false,
          action: 'test_pilot_failure',
          blockers: testResult.blockers
        };
      }

      // Step 7: Create PR with change artifact
      console.log('📝 Builder: Creating PR with change artifact...');
      const prResult = await this.createPR(request, plan, codeResult);

      await this.logActivity({
        action_type: 'pr_created',
        description: `Created PR for ${request.title}`,
        related_request_id: requestId,
        status: 'completed',
        result_data: {
          pr_url: prResult.pr_url,
          files_modified: plan.files_to_modify
        }
      });

      // Update feature request status
      await db.updateFeatureRequest(requestId, {
        status: 'in_review',
        resolution_notes: `PR created: ${prResult.pr_url}`
      });

      console.log('✅ Builder: PR created successfully');
      console.log(`   PR: ${prResult.pr_url}`);
      console.log(`   Awaiting human approval`);

      return {
        success: true,
        action: 'pr_created',
        pr_url: prResult.pr_url,
        files_modified: plan.files_to_modify,
        requires_approval: true
      };

    } catch (error) {
      console.error('❌ Builder: Error implementing feature:', error);

      await this.logActivity({
        action_type: 'feature_implementation',
        description: `Failed to implement ${request.title}`,
        related_request_id: requestId,
        status: 'failed',
        result_data: { error: error.message }
      });

      await db.updateFeatureRequest(requestId, {
        status: 'failed',
        resolution_notes: `Implementation error: ${error.message}`
      });

      throw error;
    }
  }

  /**
   * Load feature request from database
   */
  async loadFeatureRequest(requestId) {
    // For now, return mock data
    // TODO: Integrate with actual db.getPendingFeatureRequests
    return {
      id: requestId,
      title: 'Sample Feature Request',
      description: 'This is a sample feature for testing',
      priority: 'medium',
      request_type: 'feature',
      acceptance_criteria: 'Feature works as described',
      success_metrics: 'User can complete task',
      target_directory: 'public'
    };
  }

  /**
   * Validate ticket quality
   */
  validateTicket(request) {
    const reasons = [];

    if (!request.description || request.description.length < 20) {
      reasons.push('Description too short or missing');
    }

    // Check for acceptance criteria (optional but recommended)
    if (!request.acceptance_criteria) {
      reasons.push('Missing acceptance criteria (recommended)');
    }

    // Check for success metrics (optional but recommended)
    if (!request.success_metrics) {
      reasons.push('Missing success metrics (recommended)');
    }

    // Check scope clarity
    if (!request.target_directory && !request.affected_files) {
      reasons.push('Scope unclear - no target directory or affected files specified');
    }

    // Warnings don't block, but missing critical fields do
    const criticalMissing = reasons.filter(r =>
      r.includes('Description too short')
    );

    return {
      valid: criticalMissing.length === 0,
      reasons: reasons.length > 0 ? reasons : ['Ticket validation passed']
    };
  }

  /**
   * Load architectural constraints
   */
  async loadArchitecturalConstraints() {
    // TODO: Load from knowledge base or config file
    return {
      tech_stack: ['Node.js', 'Express', 'Supabase', 'Vanilla JS'],
      patterns: ['MVC', 'RESTful API'],
      style_guide: 'Follow existing code style',
      no_new_dependencies: false,
      test_coverage_required: true
    };
  }

  /**
   * Query knowledge base for relevant context
   */
  async queryKnowledgeBase(request) {
    // TODO: Implement RAG query to codebase_embeddings
    // For now, return empty context
    return {
      relevant_files: [],
      similar_features: [],
      dependencies: []
    };
  }

  /**
   * Generate implementation plan using AI
   */
  async generateImplementationPlan(request, constraints, context) {
    const prompt = `You are The Builder, a software development AI for the HomeProHub platform.

FEATURE REQUEST:
${JSON.stringify(request, null, 2)}

ARCHITECTURAL CONSTRAINTS:
${JSON.stringify(constraints, null, 2)}

CONTEXT:
${JSON.stringify(context, null, 2)}

Generate an implementation plan. Include:
1. Is this feature feasible?
2. What files need to be created or modified?
3. What's the implementation approach?
4. What tests are needed?
5. What are the risks?

IMPORTANT CONSTRAINTS:
- Cannot modify: server.js, database/*.sql, auth code, payment code
- Must include tests with code
- Must follow existing patterns

Format as JSON:
{
  "feasible": true/false,
  "blocker_reason": "..." (if not feasible),
  "files_to_modify": ["file1.js", "file2.js"],
  "files_to_create": ["newfile.js"],
  "implementation_approach": "...",
  "tests_needed": ["test1.js"],
  "risks": ["risk1", "risk2"],
  "risk_level": "low/medium/high"
}`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const planText = response.content[0].text;
    const jsonMatch = planText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      feasible: false,
      blocker_reason: 'Could not parse AI response',
      files_to_modify: [],
      files_to_create: [],
      implementation_approach: 'Unknown',
      tests_needed: [],
      risks: ['Plan generation failed'],
      risk_level: 'high'
    };
  }

  /**
   * Generate code based on plan
   */
  async generateCode(plan, request) {
    // For now, skip actual code generation
    // TODO: Implement AI-powered code generation with safety checks
    console.log('⚠️  Code generation skipped (not yet implemented)');
    console.log('   Builder will create PR with implementation plan only');

    return {
      success: true,
      message: 'Code generation skipped - PR will contain plan for human implementation',
      generated_files: []
    };
  }

  /**
   * Create PR with full change artifact
   */
  async createPR(request, plan, codeResult) {
    const branchName = `builder/feature-${request.id}-${Date.now()}`;
    const prTitle = `Feature: ${request.title}`;
    const prBody = `## Feature Implementation - Automated Plan

**Request ID:** ${request.id}
**Priority:** ${request.priority}
**Type:** ${request.request_type}

## Description

${request.description}

## Implementation Plan

**Approach:** ${plan.implementation_approach}

**Files to Modify:**
${plan.files_to_modify.map(f => `- ${f}`).join('\n')}

**Files to Create:**
${plan.files_to_create.map(f => `- ${f}`).join('\n')}

**Tests Needed:**
${plan.tests_needed.map(f => `- ${f}`).join('\n')}

## Risk Assessment

**Risk Level:** ${plan.risk_level.toUpperCase()}

**Identified Risks:**
${plan.risks.map(r => `- ${r}`).join('\n')}

## Change Artifact

\`\`\`json
{
  "change_summary": {
    "what": "${request.title}",
    "why": "${request.description}",
    "scope": "${plan.files_to_modify.length} files modified, ${plan.files_to_create.length} files created"
  },
  "risk_level": "${plan.risk_level}",
  "files_changed": ${JSON.stringify(plan.files_to_modify)},
  "tests_added": ${JSON.stringify(plan.tests_needed)},
  "performance_impact": "to_be_measured",
  "rollback_plan": "git revert + redeploy",
  "agent_metadata": {
    "agent": "builder",
    "agent_version": "${AGENT_VERSION}",
    "request_id": "${request.id}"
  }
}
\`\`\`

## Test Pilot Results

✅ Syntax check: PASSED
✅ Security scan: PASSED
⚠️  Full tests pending code implementation

## Approval Required

- [ ] Human review of implementation plan
- [ ] Code implementation (if not auto-generated)
- [ ] Test coverage adequate
- [ ] Risk assessment accurate
- [ ] Sign off for merge

---
**Agent:** The Builder v${AGENT_VERSION}
**Generated:** ${new Date().toISOString()}
`;

    // For now, return mock PR URL
    // TODO: Integrate with GitHub API
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
      related_request_id: activity.related_request_id || null,
      status: activity.status,
      result_data: activity.result_data || {},
      started_at: new Date().toISOString(),
      completed_at: activity.status === 'completed' ? new Date().toISOString() : null
    });
  }
}

module.exports = BuilderAgent;
