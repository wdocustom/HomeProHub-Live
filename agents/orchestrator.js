/**
 * Agent Orchestration Service
 *
 * Coordinates The Mechanic, The Builder, and The Improver
 * Enforces safety constraints, approval workflows, and conflict resolution
 *
 * CRITICAL PRINCIPLES:
 * - All agent actions logged immutably
 * - No agent can trigger another without approval
 * - Rate limiting enforced
 * - Conflicts detected and blocked
 * - Human approval required for all PRs
 *
 * WORKFLOW:
 * 1. Agent requests action
 * 2. Orchestrator validates with policy engine
 * 3. Check rate limits
 * 4. Check for conflicts
 * 5. Execute if approved
 * 6. Log all activity
 * 7. Notify humans
 */

const db = require('../database/db');
const { checkAgentRateLimit, getAgentConfig } = require('../database/db');
const MechanicAgent = require('./MechanicAgent');
const BuilderAgent = require('./BuilderAgent');
const ImproverAgent = require('./ImproverAgent');

class AgentOrchestrator {
  constructor() {
    this.mechanic = new MechanicAgent();
    this.builder = new BuilderAgent();
    this.improver = new ImproverAgent();

    this.activeJobs = new Map(); // Track currently running agent jobs
  }

  /**
   * Trigger The Mechanic to handle an incident
   *
   * @param {Object} incident - Error/incident details
   * @returns {Promise<Object>} Result
   */
  async triggerMechanic(incident) {
    console.log('🎯 Orchestrator: Triggering Mechanic...');

    // Check if Mechanic is enabled
    const config = await getAgentConfig('mechanic');
    if (config && !config.is_enabled) {
      console.log('⚠️  Mechanic is disabled in configuration');
      return {
        success: false,
        reason: 'Agent disabled',
        agent: 'mechanic'
      };
    }

    // Check rate limits
    const canRun = await checkAgentRateLimit('mechanic');
    if (!canRun) {
      console.warn('⚠️  Mechanic rate limit exceeded');
      return {
        success: false,
        reason: 'Rate limit exceeded',
        agent: 'mechanic'
      };
    }

    // Check for conflicts (is Mechanic already working on this error?)
    const conflict = await this.checkConflict('mechanic', { error_id: incident.error_id });
    if (conflict.has_conflict) {
      console.warn('⚠️  Mechanic already working on this incident');
      return {
        success: false,
        reason: 'Conflict detected',
        conflict: conflict,
        agent: 'mechanic'
      };
    }

    // Execute
    try {
      const jobId = `mechanic-${Date.now()}`;
      this.activeJobs.set(jobId, {
        agent: 'mechanic',
        started: new Date(),
        incident_id: incident.error_id
      });

      const result = await this.mechanic.handleIncident(incident);

      this.activeJobs.delete(jobId);

      // If PR created, send notification
      if (result.action === 'pr_created') {
        await this.notifyHumans({
          type: 'pr_created',
          agent: 'mechanic',
          pr_url: result.pr_url,
          incident_id: incident.error_id,
          requires_approval: true
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Orchestrator: Mechanic failed:', error);
      return {
        success: false,
        reason: 'Execution error',
        error: error.message,
        agent: 'mechanic'
      };
    }
  }

  /**
   * Trigger The Builder to implement a feature
   *
   * @param {string} requestId - Feature request ID
   * @returns {Promise<Object>} Result
   */
  async triggerBuilder(requestId) {
    console.log('🎯 Orchestrator: Triggering Builder...');

    // Check if Builder is enabled
    const config = await getAgentConfig('builder');
    if (config && !config.is_enabled) {
      console.log('⚠️  Builder is disabled in configuration');
      return {
        success: false,
        reason: 'Agent disabled',
        agent: 'builder'
      };
    }

    // Check rate limits
    const canRun = await checkAgentRateLimit('builder');
    if (!canRun) {
      console.warn('⚠️  Builder rate limit exceeded');
      return {
        success: false,
        reason: 'Rate limit exceeded',
        agent: 'builder'
      };
    }

    // Check for conflicts
    const conflict = await this.checkConflict('builder', { request_id: requestId });
    if (conflict.has_conflict) {
      console.warn('⚠️  Builder already working on this feature');
      return {
        success: false,
        reason: 'Conflict detected',
        conflict: conflict,
        agent: 'builder'
      };
    }

    // Execute
    try {
      const jobId = `builder-${Date.now()}`;
      this.activeJobs.set(jobId, {
        agent: 'builder',
        started: new Date(),
        request_id: requestId
      });

      const result = await this.builder.implementFeature(requestId);

      this.activeJobs.delete(jobId);

      // If PR created, send notification
      if (result.action === 'pr_created') {
        await this.notifyHumans({
          type: 'pr_created',
          agent: 'builder',
          pr_url: result.pr_url,
          request_id: requestId,
          requires_approval: true
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Orchestrator: Builder failed:', error);
      return {
        success: false,
        reason: 'Execution error',
        error: error.message,
        agent: 'builder'
      };
    }
  }

  /**
   * Trigger The Improver to run proactive analysis
   *
   * @param {Object} options - { trigger_type, metrics }
   * @returns {Promise<Object>} Result
   */
  async triggerImprover(options) {
    console.log('🎯 Orchestrator: Triggering Improver...');

    // Check if Improver is enabled
    const config = await getAgentConfig('improver');
    if (config && !config.is_enabled) {
      console.log('⚠️  Improver is disabled in configuration');
      return {
        success: false,
        reason: 'Agent disabled',
        agent: 'improver'
      };
    }

    // Check rate limits
    const canRun = await checkAgentRateLimit('improver');
    if (!canRun) {
      console.warn('⚠️  Improver rate limit exceeded');
      return {
        success: false,
        reason: 'Rate limit exceeded',
        agent: 'improver'
      };
    }

    // Improver doesn't have conflicts (it only creates tickets)

    // Execute
    try {
      const jobId = `improver-${Date.now()}`;
      this.activeJobs.set(jobId, {
        agent: 'improver',
        started: new Date(),
        trigger_type: options.trigger_type
      });

      const result = await this.improver.runAnalysis(options);

      this.activeJobs.delete(jobId);

      // Notify humans of created tickets
      if (result.action === 'tickets_created' && result.tickets.length > 0) {
        await this.notifyHumans({
          type: 'tickets_created',
          agent: 'improver',
          ticket_count: result.tickets.length,
          trigger_type: options.trigger_type
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Orchestrator: Improver failed:', error);
      return {
        success: false,
        reason: 'Execution error',
        error: error.message,
        agent: 'improver'
      };
    }
  }

  /**
   * Check for conflicts (is another agent working on the same thing?)
   *
   * @param {string} agentType - Agent type
   * @param {Object} context - { error_id, request_id, etc. }
   * @returns {Promise<Object>} { has_conflict: boolean, details: Object }
   */
  async checkConflict(agentType, context) {
    // Check active jobs
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.agent === agentType) {
        if (context.error_id && job.incident_id === context.error_id) {
          return {
            has_conflict: true,
            type: 'active_job',
            job_id: jobId,
            started: job.started
          };
        }

        if (context.request_id && job.request_id === context.request_id) {
          return {
            has_conflict: true,
            type: 'active_job',
            job_id: jobId,
            started: job.started
          };
        }
      }
    }

    // Check recent agent activity (last 30 minutes)
    const recentActivity = await db.getAgentActivity(agentType, 10);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    for (const activity of recentActivity) {
      if (new Date(activity.started_at) < thirtyMinutesAgo) continue;

      if (activity.status === 'started' || activity.status === 'in_progress') {
        if (context.error_id && activity.related_error_id === context.error_id) {
          return {
            has_conflict: true,
            type: 'recent_activity',
            activity_id: activity.id,
            started: activity.started_at
          };
        }

        if (context.request_id && activity.related_request_id === context.request_id) {
          return {
            has_conflict: true,
            type: 'recent_activity',
            activity_id: activity.id,
            started: activity.started_at
          };
        }
      }
    }

    return { has_conflict: false };
  }

  /**
   * Notify humans of agent activity
   *
   * @param {Object} notification - Notification details
   */
  async notifyHumans(notification) {
    console.log('📬 Orchestrator: Notifying humans...');

    // Create notification in database
    await db.createNotification({
      user_email: process.env.ADMIN_EMAIL || 'admin@homeprohub.today',
      notification_type: `agent_${notification.type}`,
      title: this.getNotificationTitle(notification),
      message: this.getNotificationMessage(notification),
      action_url: notification.pr_url || null,
      created_at: new Date().toISOString(),
      read: false
    });

    console.log('✅ Notification sent');
  }

  /**
   * Generate notification title
   */
  getNotificationTitle(notification) {
    switch (notification.type) {
      case 'pr_created':
        return `${notification.agent}: New PR requires approval`;
      case 'tickets_created':
        return `${notification.agent}: ${notification.ticket_count} improvement tickets created`;
      default:
        return `${notification.agent}: Activity notification`;
    }
  }

  /**
   * Generate notification message
   */
  getNotificationMessage(notification) {
    switch (notification.type) {
      case 'pr_created':
        return `The ${notification.agent} has created a PR that requires human approval: ${notification.pr_url}`;
      case 'tickets_created':
        return `The ${notification.agent} has created ${notification.ticket_count} improvement tickets based on ${notification.trigger_type} metrics.`;
      default:
        return `The ${notification.agent} has performed an action.`;
    }
  }

  /**
   * Get status of all agents
   *
   * @returns {Object} Status summary
   */
  async getStatus() {
    const mechanicConfig = await getAgentConfig('mechanic');
    const builderConfig = await getAgentConfig('builder');
    const improverConfig = await getAgentConfig('improver');

    return {
      mechanic: {
        enabled: mechanicConfig?.is_enabled !== false,
        active_jobs: Array.from(this.activeJobs.values()).filter(j => j.agent === 'mechanic').length,
        recent_activity: (await db.getAgentActivity('mechanic', 5)).length
      },
      builder: {
        enabled: builderConfig?.is_enabled !== false,
        active_jobs: Array.from(this.activeJobs.values()).filter(j => j.agent === 'builder').length,
        recent_activity: (await db.getAgentActivity('builder', 5)).length
      },
      improver: {
        enabled: improverConfig?.is_enabled !== false,
        active_jobs: Array.from(this.activeJobs.values()).filter(j => j.agent === 'improver').length,
        recent_activity: (await db.getAgentActivity('improver', 5)).length
      },
      total_active_jobs: this.activeJobs.size
    };
  }
}

// Singleton instance
const orchestrator = new AgentOrchestrator();

module.exports = orchestrator;
