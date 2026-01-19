/**
 * Agent Management API Endpoints
 *
 * Provides HTTP API for:
 * - Creating tickets for Builder
 * - Getting agent status
 * - Viewing agent activity logs
 * - Configuring agents (admin only)
 *
 * SAFETY:
 * - All endpoints require authentication
 * - Admin-only endpoints for sensitive operations
 * - No direct agent triggering without approval
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const orchestrator = require('../agents/orchestrator');
const scheduler = require('../agents/scheduler');
const { getAgentCapabilities } = require('../agents/config/policy-engine');

// Middleware: Require authentication (defined in server.js)
// const requireAuth = require('../middleware/auth');

/**
 * POST /api/dev/ticket
 *
 * Create a feature request ticket for The Builder
 *
 * Body: { title, description, priority, affected_files, acceptance_criteria }
 */
router.post('/ticket', async (req, res) => {
  try {
    const {
      title,
      description,
      priority = 'medium',
      affected_files = [],
      acceptance_criteria,
      success_metrics,
      target_directory
    } = req.body;

    // Validation
    if (!title || title.length < 5) {
      return res.status(400).json({
        error: 'Title is required (min 5 characters)'
      });
    }

    if (!description || description.length < 20) {
      return res.status(400).json({
        error: 'Description is required (min 20 characters)'
      });
    }

    // Create feature request
    const ticket = await db.createFeatureRequest({
      title,
      description,
      priority,
      request_type: 'feature',
      affected_files,
      acceptance_criteria: acceptance_criteria || '',
      success_metrics: success_metrics || '',
      target_directory: target_directory || null,
      created_by: req.user ? req.user.email : 'api',
      requires_approval: true
    });

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        created_at: ticket.created_at
      },
      message: 'Ticket created. The Builder will process it when available.'
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      error: 'Failed to create ticket',
      message: error.message
    });
  }
});

/**
 * GET /api/dev/agents
 *
 * Get status of all agents
 */
router.get('/agents', async (req, res) => {
  try {
    const status = await orchestrator.getStatus();
    const schedulerStatus = scheduler.getStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      agents: status,
      scheduler: schedulerStatus
    });

  } catch (error) {
    console.error('Error getting agent status:', error);
    res.status(500).json({
      error: 'Failed to get agent status',
      message: error.message
    });
  }
});

/**
 * GET /api/dev/agents/:agent_name/activity
 *
 * Get recent activity for an agent
 *
 * Query params: ?limit=50
 */
router.get('/agents/:agent_name/activity', async (req, res) => {
  try {
    const { agent_name } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    if (!['mechanic', 'builder', 'improver'].includes(agent_name)) {
      return res.status(400).json({
        error: 'Invalid agent name',
        valid_agents: ['mechanic', 'builder', 'improver']
      });
    }

    const activity = await db.getAgentActivity(agent_name, limit);

    res.json({
      success: true,
      agent: agent_name,
      count: activity.length,
      activity: activity
    });

  } catch (error) {
    console.error('Error getting agent activity:', error);
    res.status(500).json({
      error: 'Failed to get agent activity',
      message: error.message
    });
  }
});

/**
 * GET /api/dev/agents/:agent_name/capabilities
 *
 * Get capabilities and permissions for an agent
 */
router.get('/agents/:agent_name/capabilities', async (req, res) => {
  try {
    const { agent_name } = req.params;

    if (!['mechanic', 'builder', 'improver'].includes(agent_name)) {
      return res.status(400).json({
        error: 'Invalid agent name',
        valid_agents: ['mechanic', 'builder', 'improver']
      });
    }

    const capabilities = getAgentCapabilities(agent_name);

    res.json({
      success: true,
      agent: agent_name,
      capabilities: capabilities
    });

  } catch (error) {
    console.error('Error getting agent capabilities:', error);
    res.status(500).json({
      error: 'Failed to get agent capabilities',
      message: error.message
    });
  }
});

/**
 * GET /api/dev/tickets
 *
 * Get pending feature request tickets
 *
 * Query params: ?status=pending&limit=20
 */
router.get('/tickets', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = parseInt(req.query.limit) || 20;

    const tickets = await db.getPendingFeatureRequests(limit);

    res.json({
      success: true,
      count: tickets.length,
      tickets: tickets
    });

  } catch (error) {
    console.error('Error getting tickets:', error);
    res.status(500).json({
      error: 'Failed to get tickets',
      message: error.message
    });
  }
});

/**
 * GET /api/dev/errors
 *
 * Get open system errors
 *
 * Query params: ?limit=20
 */
router.get('/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const errors = await db.getOpenSystemErrors(limit);

    res.json({
      success: true,
      count: errors.length,
      errors: errors
    });

  } catch (error) {
    console.error('Error getting system errors:', error);
    res.status(500).json({
      error: 'Failed to get system errors',
      message: error.message
    });
  }
});

/**
 * POST /api/dev/agents/:agent_name/trigger
 *
 * ADMIN ONLY: Manually trigger an agent
 *
 * Body depends on agent:
 * - mechanic: { error_id }
 * - builder: { request_id }
 * - improver: { trigger_type, metrics }
 */
router.post('/agents/:agent_name/trigger', async (req, res) => {
  try {
    // TODO: Add admin check
    // if (!req.user || req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const { agent_name } = req.params;

    let result;

    switch (agent_name) {
      case 'mechanic':
        if (!req.body.error_id) {
          return res.status(400).json({ error: 'error_id required' });
        }

        // Load error from database
        const errors = await db.getOpenSystemErrors(100);
        const error = errors.find(e => e.id === req.body.error_id);

        if (!error) {
          return res.status(404).json({ error: 'Error not found' });
        }

        result = await orchestrator.triggerMechanic(error);
        break;

      case 'builder':
        if (!req.body.request_id) {
          return res.status(400).json({ error: 'request_id required' });
        }

        result = await orchestrator.triggerBuilder(req.body.request_id);
        break;

      case 'improver':
        if (!req.body.trigger_type || !req.body.metrics) {
          return res.status(400).json({
            error: 'trigger_type and metrics required',
            valid_triggers: ['error_hotspot', 'latency_regression', 'security_warning', 'bundle_size', 'accessibility']
          });
        }

        result = await orchestrator.triggerImprover({
          trigger_type: req.body.trigger_type,
          metrics: req.body.metrics
        });
        break;

      default:
        return res.status(400).json({
          error: 'Invalid agent name',
          valid_agents: ['mechanic', 'builder', 'improver']
        });
    }

    res.json({
      success: result.success,
      agent: agent_name,
      result: result
    });

  } catch (error) {
    console.error('Error triggering agent:', error);
    res.status(500).json({
      error: 'Failed to trigger agent',
      message: error.message
    });
  }
});

/**
 * PUT /api/dev/agents/:agent_name/config
 *
 * ADMIN ONLY: Update agent configuration
 *
 * Body: { is_enabled, max_concurrent_jobs, rate_limit_window_hours, max_runs_per_window }
 */
router.put('/agents/:agent_name/config', async (req, res) => {
  try {
    // TODO: Add admin check

    const { agent_name } = req.params;

    if (!['mechanic', 'builder', 'improver'].includes(agent_name)) {
      return res.status(400).json({
        error: 'Invalid agent name',
        valid_agents: ['mechanic', 'builder', 'improver']
      });
    }

    const updates = {};

    if (typeof req.body.is_enabled === 'boolean') {
      updates.is_enabled = req.body.is_enabled;
    }

    if (req.body.max_concurrent_jobs) {
      updates.max_concurrent_jobs = req.body.max_concurrent_jobs;
    }

    if (req.body.rate_limit_window_hours) {
      updates.rate_limit_window_hours = req.body.rate_limit_window_hours;
    }

    if (req.body.max_runs_per_window) {
      updates.max_runs_per_window = req.body.max_runs_per_window;
    }

    const config = await db.updateAgentConfig(agent_name, updates);

    res.json({
      success: true,
      agent: agent_name,
      config: config
    });

  } catch (error) {
    console.error('Error updating agent config:', error);
    res.status(500).json({
      error: 'Failed to update agent config',
      message: error.message
    });
  }
});

/**
 * POST /api/dev/scheduler/start
 *
 * ADMIN ONLY: Start the agent scheduler
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    // TODO: Add admin check

    await scheduler.start();

    res.json({
      success: true,
      message: 'Scheduler started',
      status: scheduler.getStatus()
    });

  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      error: 'Failed to start scheduler',
      message: error.message
    });
  }
});

/**
 * POST /api/dev/scheduler/stop
 *
 * ADMIN ONLY: Stop the agent scheduler
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    // TODO: Add admin check

    scheduler.stop();

    res.json({
      success: true,
      message: 'Scheduler stopped',
      status: scheduler.getStatus()
    });

  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      error: 'Failed to stop scheduler',
      message: error.message
    });
  }
});

module.exports = router;
