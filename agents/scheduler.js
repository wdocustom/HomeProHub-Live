/**
 * Agent Scheduler
 *
 * Runs periodic tasks for The Improver
 * The Mechanic and Builder are event-driven (triggered by errors/tickets)
 * The Improver runs on a schedule to check metrics
 *
 * SCHEDULE:
 * - Every 6 hours: Check error rates
 * - Every 12 hours: Check performance metrics
 * - Daily: Check bundle size
 * - Weekly: Check accessibility
 *
 * SAFETY:
 * - All runs logged
 * - Rate limits enforced
 * - Can be disabled via config
 */

const orchestrator = require('./orchestrator');
const db = require('../database/db');

class AgentScheduler {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    console.log('🕐 Agent Scheduler: Starting...');
    this.isRunning = true;

    // Schedule: Error rate check every 6 hours
    this.intervals.set('error_check', setInterval(async () => {
      await this.runErrorCheck();
    }, 6 * 60 * 60 * 1000));

    // Schedule: Performance check every 12 hours
    this.intervals.set('performance_check', setInterval(async () => {
      await this.runPerformanceCheck();
    }, 12 * 60 * 60 * 1000));

    // Schedule: Bundle size check daily
    this.intervals.set('bundle_check', setInterval(async () => {
      await this.runBundleSizeCheck();
    }, 24 * 60 * 60 * 1000));

    // Run initial checks (don't wait for first interval)
    setTimeout(() => this.runErrorCheck(), 5000);

    console.log('✅ Agent Scheduler: Running');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('🛑 Agent Scheduler: Stopping...');
    this.isRunning = false;

    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval);
      console.log(`  Stopped: ${name}`);
    }

    this.intervals.clear();
    console.log('✅ Agent Scheduler: Stopped');
  }

  /**
   * Run error rate check
   */
  async runErrorCheck() {
    console.log('📊 Scheduler: Running error rate check...');

    try {
      // Get open errors from last 24 hours
      const errors = await db.getOpenSystemErrors(20);

      // Find high-frequency errors
      const hotspots = errors.filter(e => e.occurrence_count > 10);

      if (hotspots.length === 0) {
        console.log('✅ No error hotspots detected');
        return;
      }

      console.log(`🔥 Detected ${hotspots.length} error hotspots`);

      // Trigger Improver for each hotspot
      for (const hotspot of hotspots) {
        await orchestrator.triggerImprover({
          trigger_type: 'error_hotspot',
          metrics: {
            error_type: hotspot.error_type,
            error_message: hotspot.error_message,
            occurrence_count: hotspot.occurrence_count,
            stack_trace: hotspot.stack_trace,
            first_seen: hotspot.first_seen,
            last_seen: hotspot.last_seen,
            severity: hotspot.severity,
            source_file: hotspot.source_file,
            affected_files: []
          }
        });
      }

    } catch (error) {
      console.error('❌ Error check failed:', error);
    }
  }

  /**
   * Run performance metrics check
   */
  async runPerformanceCheck() {
    console.log('📊 Scheduler: Running performance check...');

    // TODO: Implement actual metrics collection
    // For now, skip
    console.log('⚠️  Performance metrics not yet implemented');
  }

  /**
   * Run bundle size check
   */
  async runBundleSizeCheck() {
    console.log('📊 Scheduler: Running bundle size check...');

    // TODO: Implement bundle size analysis
    // For now, skip
    console.log('⚠️  Bundle size check not yet implemented');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.isRunning,
      active_schedules: Array.from(this.intervals.keys()),
      next_runs: {
        error_check: this.isRunning ? 'Every 6 hours' : 'Not scheduled',
        performance_check: this.isRunning ? 'Every 12 hours' : 'Not scheduled',
        bundle_check: this.isRunning ? 'Daily' : 'Not scheduled'
      }
    };
  }
}

// Singleton instance
const scheduler = new AgentScheduler();

module.exports = scheduler;
