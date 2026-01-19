/**
 * Policy & Capability Engine
 *
 * Enforces file-level and action-level permissions for autonomous agents.
 *
 * CRITICAL PRINCIPLE:
 * "Agents must be denied at the tool level, not by convention."
 *
 * This is the authoritative enforcement layer. Agents cannot bypass it.
 */

const path = require('path');
const minimatch = require('minimatch');

/**
 * File-level permissions by agent type
 *
 * false = DENIED (agent cannot read or modify)
 * true = ALLOWED (agent can read and modify)
 * "read_only" = READ ONLY (agent can read but not modify)
 */
const FILE_PERMISSIONS = {
  // Database schemas and migrations - HUMAN ONLY
  'database/*.sql': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Core server file - NO AGENT ACCESS
  'server.js': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Database configuration - NO AGENT ACCESS
  'database/db.js': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Auto-migrations - NO AGENT ACCESS
  'database/auto-migrations.js': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Environment files - NO AGENT ACCESS
  '.env*': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // PM2 and deployment configs - NO AGENT ACCESS
  'ecosystem.config.js': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Package files - READ ONLY for all agents
  'package*.json': {
    mechanic: 'read_only',
    builder: 'read_only',
    improver: 'read_only',
    human_only: false
  },

  // Frontend HTML files - Builder can modify, others read-only
  'public/**/*.html': {
    mechanic: 'read_only',
    builder: true,
    improver: 'read_only',
    human_only: false
  },

  // Frontend JavaScript - Builder can modify, Improver read-only
  'public/**/*.js': {
    mechanic: 'read_only',
    builder: true,
    improver: 'read_only',
    human_only: false
  },

  // CSS files - Builder and Improver can modify
  'public/**/*.css': {
    mechanic: 'read_only',
    builder: true,
    improver: true,
    human_only: false
  },

  // API routes - Builder can create new, Mechanic read-only
  'routes/**/*.js': {
    mechanic: 'read_only',
    builder: true,
    improver: 'read_only',
    human_only: false
  },

  // Services - Mechanic can fix bugs, Builder can create new
  'services/**/*.js': {
    mechanic: true,
    builder: true,
    improver: 'read_only',
    human_only: false
  },

  // Agent code - NO AGENT CAN MODIFY THEMSELVES
  'agents/**/*.js': {
    mechanic: false,
    builder: false,
    improver: false,
    human_only: true
  },

  // Tests - Builder can create/modify
  'test/**/*.js': {
    mechanic: 'read_only',
    builder: true,
    improver: 'read_only',
    human_only: false
  },

  // Documentation - All agents can read, Improver can suggest updates
  '**/*.md': {
    mechanic: 'read_only',
    builder: 'read_only',
    improver: 'read_only', // Creates tickets for doc updates, doesn't modify directly
    human_only: false
  }
};

/**
 * Action-level capabilities by agent type
 *
 * Defines what each agent is allowed to do at the system level
 */
const ACTION_CAPABILITIES = {
  mechanic: {
    // The Mechanic fixes bugs and handles incidents
    can_read_errors: true,
    can_read_logs: true,
    can_create_pr: true,
    can_run_tests: true,
    can_rollback: false, // Must create rollback PR, not execute directly
    can_apply_migration: false, // NEVER
    can_deploy: false, // NEVER
    can_modify_schema: false, // NEVER
    can_create_tickets: true,
    requires_approval: true, // ALL changes require approval
    max_files_per_pr: 5, // Limit scope
    restricted_patterns: ['auth', 'payment', 'database']
  },

  builder: {
    // The Builder implements features from validated tickets
    can_read_errors: false,
    can_read_logs: false,
    can_create_pr: true,
    can_run_tests: true,
    can_rollback: false,
    can_apply_migration: false, // Can propose migrations via PR only
    can_deploy: false,
    can_modify_schema: false, // Can propose schema changes via migration PR
    can_create_tickets: false,
    requires_approval: true, // ALL changes require approval
    max_files_per_pr: 10,
    restricted_patterns: ['auth', 'payment'] // Cannot touch auth or payment code
  },

  improver: {
    // The Improver creates tickets, does NOT write code directly
    can_read_errors: true,
    can_read_logs: true,
    can_create_pr: false, // NEVER creates PRs directly
    can_run_tests: false,
    can_rollback: false,
    can_apply_migration: false,
    can_deploy: false,
    can_modify_schema: false,
    can_create_tickets: true, // Primary action: creates tickets for Builder
    requires_approval: false, // Tickets don't require approval, just creation
    max_tickets_per_run: 3, // Limit ticket spam
    restricted_patterns: []
  }
};

/**
 * Check if an agent has permission to access a file
 *
 * @param {string} agentType - 'mechanic', 'builder', or 'improver'
 * @param {string} filePath - Relative path from project root
 * @param {string} accessType - 'read' or 'write'
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkFilePermission(agentType, filePath, accessType = 'read') {
  // Normalize path
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check each permission pattern
  for (const [pattern, permissions] of Object.entries(FILE_PERMISSIONS)) {
    if (minimatch(normalizedPath, pattern)) {
      const permission = permissions[agentType];

      // No permission at all
      if (permission === false) {
        return {
          allowed: false,
          reason: `Agent '${agentType}' is denied access to ${pattern}. This file is ${permissions.human_only ? 'HUMAN ONLY' : 'restricted'}.`
        };
      }

      // Read-only permission
      if (permission === 'read_only' && accessType === 'write') {
        return {
          allowed: false,
          reason: `Agent '${agentType}' has READ ONLY access to ${pattern}. Write access denied.`
        };
      }

      // Full permission
      if (permission === true) {
        return {
          allowed: true,
          reason: `Agent '${agentType}' has ${accessType} access to ${pattern}.`
        };
      }

      // Read-only and requesting read
      if (permission === 'read_only' && accessType === 'read') {
        return {
          allowed: true,
          reason: `Agent '${agentType}' has read-only access to ${pattern}.`
        };
      }
    }
  }

  // Default deny
  return {
    allowed: false,
    reason: `No explicit permission found for '${agentType}' to ${accessType} ${normalizedPath}. Default: DENY.`
  };
}

/**
 * Check if an agent has capability to perform an action
 *
 * @param {string} agentType - 'mechanic', 'builder', or 'improver'
 * @param {string} action - Action name (e.g., 'can_deploy', 'can_create_pr')
 * @returns {Object} { allowed: boolean, reason: string, metadata: Object }
 */
function checkActionCapability(agentType, action) {
  const capabilities = ACTION_CAPABILITIES[agentType];

  if (!capabilities) {
    return {
      allowed: false,
      reason: `Unknown agent type: ${agentType}`,
      metadata: null
    };
  }

  if (!(action in capabilities)) {
    return {
      allowed: false,
      reason: `Unknown action: ${action}`,
      metadata: null
    };
  }

  const allowed = capabilities[action] === true;

  return {
    allowed,
    reason: allowed
      ? `Agent '${agentType}' is authorized for action '${action}'`
      : `Agent '${agentType}' is NOT authorized for action '${action}'`,
    metadata: capabilities
  };
}

/**
 * Validate a proposed change before agent can proceed
 *
 * @param {string} agentType - Agent making the change
 * @param {Array<string>} filePaths - Files to be modified
 * @param {string} changeType - 'pr' | 'ticket' | 'rollback'
 * @returns {Object} { approved: boolean, violations: Array, warnings: Array }
 */
function validateProposedChange(agentType, filePaths, changeType = 'pr') {
  const violations = [];
  const warnings = [];
  const capabilities = ACTION_CAPABILITIES[agentType];

  // Check action capability
  if (changeType === 'pr') {
    const canCreatePR = checkActionCapability(agentType, 'can_create_pr');
    if (!canCreatePR.allowed) {
      violations.push({
        type: 'action_denied',
        message: canCreatePR.reason
      });
    }
  }

  // Check file permissions
  for (const filePath of filePaths) {
    const permission = checkFilePermission(agentType, filePath, 'write');
    if (!permission.allowed) {
      violations.push({
        type: 'file_denied',
        file: filePath,
        message: permission.reason
      });
    }
  }

  // Check file count limits
  if (capabilities && capabilities.max_files_per_pr) {
    if (filePaths.length > capabilities.max_files_per_pr) {
      violations.push({
        type: 'scope_exceeded',
        message: `Agent '${agentType}' can modify max ${capabilities.max_files_per_pr} files per PR. Attempted: ${filePaths.length}`
      });
    }
  }

  // Check restricted patterns
  if (capabilities && capabilities.restricted_patterns) {
    for (const filePath of filePaths) {
      for (const pattern of capabilities.restricted_patterns) {
        if (filePath.toLowerCase().includes(pattern)) {
          warnings.push({
            type: 'restricted_pattern',
            file: filePath,
            pattern: pattern,
            message: `File contains restricted pattern '${pattern}'. Extra scrutiny required.`
          });
        }
      }
    }
  }

  return {
    approved: violations.length === 0,
    violations,
    warnings,
    requires_approval: capabilities ? capabilities.requires_approval : true
  };
}

/**
 * Get full capabilities summary for an agent
 *
 * @param {string} agentType - Agent type
 * @returns {Object} Capabilities and permissions
 */
function getAgentCapabilities(agentType) {
  return {
    agent: agentType,
    actions: ACTION_CAPABILITIES[agentType] || {},
    file_patterns: Object.entries(FILE_PERMISSIONS)
      .filter(([pattern, perms]) => perms[agentType] !== false)
      .map(([pattern, perms]) => ({
        pattern,
        access: perms[agentType]
      }))
  };
}

module.exports = {
  FILE_PERMISSIONS,
  ACTION_CAPABILITIES,
  checkFilePermission,
  checkActionCapability,
  validateProposedChange,
  getAgentCapabilities
};
