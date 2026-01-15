/**
 * ========================================
 * Universal Agent Services - Context-Aware AI Agents
 * ========================================
 * Date: 2026-01-15
 * Purpose: Implement template-driven agent logic for Auto-GC
 *
 * The "Swarm": 9-agent crew that adapts behavior based on project template
 * - Orchestrator: Master coordinator (manages state machine)
 * - Visionary: Intake & Architect (analyzes blueprints, extracts requirements)
 * - Shark: Procurement specialist (finds contractors dynamically)
 * - Whip: Scheduler (implements Critical Path Method)
 * - Diplomat: Communication handler (manages notifications)
 * - Sentinel: Vision/QC inspector (checks code compliance)
 * - Inspector: Quality control (validates work against standards)
 * - Summarizer: Report generator (already implemented)
 * - Hawk: Monitoring agent (tracks progress, detects issues)
 */

const OpenAI = require('openai');
const db = require('../database/db');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========================================
// Helper: Get Project Template
// ========================================
async function getProjectTemplate(projectId) {
  const query = `
    SELECT
      j.id as project_id,
      j.title,
      j.template_id,
      j.blueprints_url,
      j.project_metadata,
      pt.*
    FROM job_postings j
    LEFT JOIN project_templates pt ON j.template_id = pt.id
    WHERE j.id = $1
  `;

  const result = await db.query(query, [projectId]);
  if (result.rows.length === 0) {
    throw new Error(`Project ${projectId} not found`);
  }

  return result.rows[0];
}

// ========================================
// Helper: Get Project Milestones
// ========================================
async function getProjectMilestones(projectId) {
  const query = `
    SELECT *
    FROM project_milestones
    WHERE project_id = $1
    ORDER BY milestone_order ASC
  `;

  const result = await db.query(query, [projectId]);
  return result.rows;
}

// ========================================
// Helper: Log AI Agent Activity
// ========================================
async function logAgentActivity(projectId, agentType, actionType, actionDescription, inputData, outputData, status = 'completed') {
  const query = `
    INSERT INTO ai_agent_activity (
      project_id, agent_type, action_type, action_description,
      input_data, output_data, status, completed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `;

  const result = await db.query(query, [
    projectId,
    agentType,
    actionType,
    actionDescription,
    JSON.stringify(inputData),
    JSON.stringify(outputData),
    status
  ]);

  return result.rows[0];
}

// ========================================
// 1. THE ORCHESTRATOR
// Master coordinator that manages the state machine
// ========================================
class OrchestratorAgent {
  /**
   * Initialize project from template
   * Creates project_milestones from template_milestones
   */
  static async initializeProject(projectId) {
    console.log(`[Orchestrator] Initializing project ${projectId} from template...`);

    const template = await getProjectTemplate(projectId);

    if (!template.template_id) {
      throw new Error('Project does not have a template assigned');
    }

    // Get template milestones
    const templateMilestones = await db.query(
      'SELECT * FROM template_milestones WHERE template_id = $1 ORDER BY milestone_order',
      [template.template_id]
    );

    // Create project milestones from template
    const projectMilestones = [];
    const phases = template.phases || [];

    for (const phase of phases) {
      const milestone = {
        project_id: projectId,
        milestone_id: phase.phase_id,
        milestone_name: phase.phase_name,
        milestone_order: phase.order,
        status: 'pending',
        requires_inspection: phase.requires_inspection,
        depends_on: phase.dependencies || []
      };

      // Calculate planned dates based on order and estimated days
      // (This is simplified - real implementation would use CPM)
      const startOffset = phases
        .filter(p => p.order < phase.order)
        .reduce((sum, p) => sum + p.estimated_days, 0);

      milestone.planned_start_date = new Date(Date.now() + startOffset * 24 * 60 * 60 * 1000);
      milestone.planned_end_date = new Date(milestone.planned_start_date.getTime() + phase.estimated_days * 24 * 60 * 60 * 1000);

      projectMilestones.push(milestone);
    }

    // Insert all milestones
    for (const milestone of projectMilestones) {
      await db.query(`
        INSERT INTO project_milestones (
          project_id, milestone_id, milestone_name, milestone_order,
          status, requires_inspection, depends_on, planned_start_date, planned_end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (project_id, milestone_id) DO NOTHING
      `, [
        milestone.project_id,
        milestone.milestone_id,
        milestone.milestone_name,
        milestone.milestone_order,
        milestone.status,
        milestone.requires_inspection,
        JSON.stringify(milestone.depends_on),
        milestone.planned_start_date,
        milestone.planned_end_date
      ]);
    }

    // Initialize project state
    await db.query(`
      INSERT INTO project_states (
        project_id, current_phase, current_milestone_id
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id) DO UPDATE
      SET current_phase = EXCLUDED.current_phase,
          current_milestone_id = EXCLUDED.current_milestone_id
    `, [projectId, phases[0].phase_id, phases[0].phase_id]);

    await logAgentActivity(
      projectId,
      'orchestrator',
      'initialize_project',
      `Initialized project with ${projectMilestones.length} milestones from template ${template.template_name}`,
      { template_id: template.template_id, template_name: template.template_name },
      { milestones_created: projectMilestones.length },
      'completed'
    );

    console.log(`[Orchestrator] Created ${projectMilestones.length} milestones for project`);

    return {
      success: true,
      milestones_created: projectMilestones.length,
      template: template.template_name
    };
  }

  /**
   * Advance to next milestone
   * Checks dependencies before advancing
   */
  static async advanceToNextMilestone(projectId, currentMilestoneId) {
    console.log(`[Orchestrator] Attempting to advance from milestone ${currentMilestoneId}...`);

    // Mark current milestone as completed
    await db.query(`
      UPDATE project_milestones
      SET status = 'completed', actual_end_date = CURRENT_DATE
      WHERE project_id = $1 AND milestone_id = $2
    `, [projectId, currentMilestoneId]);

    // Get next milestone
    const result = await db.query(`
      SELECT * FROM project_milestones
      WHERE project_id = $1 AND status = 'pending'
      ORDER BY milestone_order ASC
      LIMIT 1
    `, [projectId]);

    if (result.rows.length === 0) {
      console.log('[Orchestrator] No more milestones - project complete!');
      return { success: true, completed: true };
    }

    const nextMilestone = result.rows[0];

    // Check if all dependencies are met
    const dependencies = nextMilestone.depends_on || [];
    const dependenciesMet = await this.checkDependencies(projectId, dependencies);

    if (!dependenciesMet) {
      console.log(`[Orchestrator] Cannot advance - dependencies not met for ${nextMilestone.milestone_id}`);
      return {
        success: false,
        reason: 'Dependencies not met',
        next_milestone: nextMilestone.milestone_id,
        dependencies
      };
    }

    // Update project state
    await db.query(`
      UPDATE project_states
      SET current_phase = $1, current_milestone_id = $2, last_activity_date = NOW()
      WHERE project_id = $3
    `, [nextMilestone.milestone_id, nextMilestone.milestone_id, projectId]);

    // Update milestone status
    await db.query(`
      UPDATE project_milestones
      SET status = 'in_progress', actual_start_date = CURRENT_DATE
      WHERE project_id = $1 AND milestone_id = $2
    `, [projectId, nextMilestone.milestone_id]);

    await logAgentActivity(
      projectId,
      'orchestrator',
      'advance_milestone',
      `Advanced from ${currentMilestoneId} to ${nextMilestone.milestone_id}`,
      { from: currentMilestoneId, to: nextMilestone.milestone_id },
      { next_milestone: nextMilestone },
      'completed'
    );

    return {
      success: true,
      next_milestone: nextMilestone,
      message: `Advanced to ${nextMilestone.milestone_name}`
    };
  }

  /**
   * Check if all dependencies are completed
   */
  static async checkDependencies(projectId, dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM project_milestones
      WHERE project_id = $1
        AND milestone_id = ANY($2)
        AND status = 'completed'
    `, [projectId, dependencies]);

    return result.rows[0].count === dependencies.length;
  }
}

// ========================================
// 2. THE VISIONARY (Intake & Architect)
// Analyzes blueprints and extracts requirements
// ========================================
class VisionaryAgent {
  /**
   * Analyze blueprints using GPT-4o Vision
   * Context: For new builds/additions that require PDF plan sets
   */
  static async analyzeBlueprintsprintPDFUrl) {
    console.log('[Visionary] Analyzing blueprints with GPT-4o Vision...');

    const template = await getProjectTemplate(projectId);

    // Context-aware prompt based on project type
    let analysisPrompt = '';

    if (template.template_type === 'new_construction') {
      analysisPrompt = `
        You are an experienced Construction Architect analyzing blueprints for a NEW CUSTOM HOME.

        Extract the following information:
        1. Total square footage
        2. Number of stories
        3. Number of bedrooms and bathrooms
        4. Foundation type (slab, crawl space, basement)
        5. Structural requirements (beams, columns, load-bearing walls)
        6. Schedule of Values (estimate material quantities):
           - Concrete (cubic yards)
           - Lumber (board feet)
           - Roofing (squares)
           - Drywall (sheets)
        7. Special features (vaulted ceilings, custom details, etc.)
        8. Permit requirements

        Format your response as structured JSON.
      `;
    } else if (template.template_type === 'addition') {
      analysisPrompt = `
        You are an experienced Construction Architect analyzing blueprints for a ROOM ADDITION.

        Extract the following information:
        1. Addition square footage
        2. How it connects to existing structure (wall opening dimensions)
        3. Foundation requirements
        4. Roofline details (matching existing or different)
        5. Structural modifications to existing house
        6. Material quantities needed
        7. Utility extensions (plumbing, electrical, HVAC)

        Format your response as structured JSON.
      `;
    } else {
      analysisPrompt = `
        You are an experienced Construction professional analyzing plans for a REMODEL.

        Extract:
        1. Scope of work
        2. Demolition requirements
        3. New fixture locations
        4. Material selections
        5. Permit requirements

        Format your response as structured JSON.
      `;
    }

    try {
      // Note: In production, you'd use GPT-4o Vision API to analyze actual blueprint images
      // This is a placeholder for the logic
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: analysisPrompt
          },
          {
            role: 'user',
            content: `Analyze these construction blueprints: ${blueprintPDFUrl}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      // Store analysis in project metadata
      await db.query(`
        UPDATE job_postings
        SET project_metadata = project_metadata || $1::jsonb,
            ai_analysis = $2
        WHERE id = $3
      `, [
        JSON.stringify(analysis),
        `Blueprint analysis completed: ${JSON.stringify(analysis, null, 2)}`,
        projectId
      ]);

      await logAgentActivity(
        projectId,
        'visionary',
        'analyze_blueprints',
        'Analyzed blueprints and extracted project requirements',
        { blueprint_url: blueprintPDFUrl, template_type: template.template_type },
        analysis,
        'completed'
      );

      console.log('[Visionary] Blueprint analysis complete');

      return {
        success: true,
        analysis
      };
    } catch (error) {
      console.error('[Visionary] Blueprint analysis failed:', error);

      await logAgentActivity(
        projectId,
        'visionary',
        'analyze_blueprints',
        'Blueprint analysis failed',
        { blueprint_url: blueprintPDFUrl },
        { error: error.message },
        'failed'
      );

      throw error;
    }
  }
}

// ========================================
// 3. THE SHARK (Procurement Specialist)
// Dynamically finds contractors based on template requirements
// ========================================
class SharkAgent {
  /**
   * Hunt for contractors based on template's required trades
   * PSEUDOCODE IMPLEMENTATION
   */
  static async huntForContractors(projectId) {
    console.log('[Shark] Hunting for contractors...');

    const template = await getProjectTemplate(projectId);

    if (!template.template_id) {
      throw new Error('Project must have a template to hunt for contractors');
    }

    // STEP 1: Get required trades from template
    const requiredTrades = template.required_trades || [];

    console.log(`[Shark] Template requires ${requiredTrades.length} trade types: ${requiredTrades.join(', ')}`);

    // STEP 2: Determine procurement priority based on project phase
    const currentMilestones = await getProjectMilestones(projectId);
    const upcomingMilestones = currentMilestones.filter(m =>
      m.status === 'pending' || m.status === 'in_progress'
    ).slice(0, 3);

    // STEP 3: Query Lead Scout database for contractors
    // (This would integrate with the Lead Scout contractor database)
    const searchResults = [];

    for (const trade of requiredTrades) {
      /*
       * PSEUDOCODE FOR SHARK LOGIC:
       *
       * function huntForTrade(trade_type, project_location):
       *   # Step 1: Query contractor database
       *   contractors = DB.query(`
       *     SELECT * FROM user_profiles
       *     WHERE role = 'contractor'
       *       AND trade = ${trade_type}
       *       AND zip_code IN (nearby_zipcodes(project_location))
       *       AND profile_complete = true
       *   `)
       *
       *   # Step 2: Filter by license verification
       *   verified_contractors = contractors.filter(c =>
       *     c.has_valid_license(trade_type) AND
       *     c.license_expiration > today()
       *   )
       *
       *   # Step 3: Rank by rating and availability
       *   ranked = verified_contractors.sort_by(
       *     rating: DESC,
       *     reviews_count: DESC,
       *     years_in_business: DESC
       *   ).limit(5)
       *
       *   # Step 4: Send automated RFQ
       *   for contractor in ranked:
       *     send_rfq(contractor, project_details, needed_by_date)
       *
       *   return ranked
       */

      // Simplified implementation
      const result = await db.query(`
        SELECT
          up.*,
          COALESCE(AVG(hr.payment_rating), 0) as avg_rating,
          COUNT(hr.id) as review_count
        FROM user_profiles up
        LEFT JOIN homeowner_ratings hr ON up.email = hr.contractor_email
        WHERE up.role = 'contractor'
          AND up.trade = $1
          AND up.profile_complete = true
        GROUP BY up.id
        ORDER BY avg_rating DESC, review_count DESC
        LIMIT 5
      `, [trade]);

      searchResults.push({
        trade,
        contractors_found: result.rows.length,
        contractors: result.rows
      });

      console.log(`[Shark] Found ${result.rows.length} contractors for ${trade}`);
    }

    // STEP 4: Log procurement activity
    await logAgentActivity(
      projectId,
      'shark',
      'hunt_contractors',
      `Hunted for ${requiredTrades.length} trade types`,
      { required_trades: requiredTrades },
      { search_results: searchResults },
      'completed'
    );

    return {
      success: true,
      required_trades: requiredTrades,
      search_results: searchResults,
      total_contractors_found: searchResults.reduce((sum, r) => sum + r.contractors_found, 0)
    };
  }

  /**
   * Context-aware contractor search
   * Example: For New Build, prioritize Excavators and Concrete first
   */
  static async getPriorityTradesForPhase(projectId, currentPhase) {
    const template = await getProjectTemplate(projectId);

    // Get template phases to determine which trades are needed NOW
    const phases = template.phases || [];
    const currentPhaseData = phases.find(p => p.phase_id === currentPhase);

    if (!currentPhaseData) {
      return [];
    }

    // Map phases to required trades
    const phaseTradeMapping = {
      'excavation': ['excavation'],
      'foundation': ['concrete', 'foundation'],
      'framing': ['framing', 'carpentry'],
      'rough_in': ['plumbing', 'electrical', 'hvac'],
      'finish': ['painting', 'flooring', 'tile'],
      'demo': ['general_contractor'],
      'cabinets': ['cabinets', 'carpentry'],
      'countertops': ['countertops']
    };

    const priorityTrades = phaseTradeMapping[currentPhase] || [];

    console.log(`[Shark] Priority trades for phase "${currentPhase}": ${priorityTrades.join(', ')}`);

    return priorityTrades;
  }
}

// ========================================
// 4. THE WHIP (Scheduler - Critical Path Method)
// Manages scheduling with CPM logic
// ========================================
class WhipAgent {
  /**
   * Implement Critical Path Method (CPM) scheduling
   * Rule: Foundation inspection is a hard blocker for all subsequent trades
   */
  static async calculateCriticalPath(projectId) {
    console.log('[Whip] Calculating Critical Path...');

    const milestones = await getProjectMilestones(projectId);

    // Build dependency graph
    const graph = {};
    const criticalPath = [];

    for (const milestone of milestones) {
      graph[milestone.milestone_id] = {
        ...milestone,
        earliest_start: null,
        earliest_finish: null,
        latest_start: null,
        latest_finish: null,
        slack: 0,
        is_critical: false
      };
    }

    // Forward pass: Calculate earliest start/finish
    for (const milestone of milestones) {
      const node = graph[milestone.milestone_id];
      const dependencies = milestone.depends_on || [];

      if (dependencies.length === 0) {
        // Start task
        node.earliest_start = 0;
      } else {
        // Find max earliest_finish of dependencies
        const maxFinish = Math.max(...dependencies.map(dep => {
          const depNode = graph[dep];
          return depNode ? depNode.earliest_finish : 0;
        }));
        node.earliest_start = maxFinish;
      }

      // Calculate duration (days between planned start and end)
      const duration = milestone.planned_end_date && milestone.planned_start_date
        ? Math.ceil((new Date(milestone.planned_end_date) - new Date(milestone.planned_start_date)) / (1000 * 60 * 60 * 24))
        : 1;

      node.earliest_finish = node.earliest_start + duration;
      node.duration = duration;
    }

    // Backward pass: Calculate latest start/finish
    const lastMilestone = milestones[milestones.length - 1];
    const projectEnd = graph[lastMilestone.milestone_id].earliest_finish;

    for (let i = milestones.length - 1; i >= 0; i--) {
      const milestone = milestones[i];
      const node = graph[milestone.milestone_id];

      // Find tasks that depend on this one
      const dependents = milestones.filter(m =>
        (m.depends_on || []).includes(milestone.milestone_id)
      );

      if (dependents.length === 0) {
        // End task
        node.latest_finish = projectEnd;
      } else {
        // Find min latest_start of dependents
        const minStart = Math.min(...dependents.map(dep => {
          const depNode = graph[dep.milestone_id];
          return depNode ? depNode.latest_start : projectEnd;
        }));
        node.latest_finish = minStart;
      }

      node.latest_start = node.latest_finish - node.duration;
      node.slack = node.latest_start - node.earliest_start;
      node.is_critical = node.slack === 0;

      if (node.is_critical) {
        criticalPath.push(milestone.milestone_id);
      }
    }

    console.log(`[Whip] Critical Path calculated: ${criticalPath.length} critical milestones`);

    // Update project_states with critical path status
    const behindSchedule = milestones.some(m => {
      if (m.status === 'completed' && m.actual_end_date && m.planned_end_date) {
        return new Date(m.actual_end_date) > new Date(m.planned_end_date);
      }
      return false;
    });

    await db.query(`
      UPDATE project_states
      SET critical_path_status = $1
      WHERE project_id = $2
    `, [behindSchedule ? 'delayed' : 'on_track', projectId]);

    await logAgentActivity(
      projectId,
      'whip',
      'calculate_critical_path',
      `Calculated critical path: ${criticalPath.length} critical tasks`,
      { total_milestones: milestones.length },
      { critical_path: criticalPath, project_end_day: projectEnd },
      'completed'
    );

    return {
      success: true,
      critical_path: criticalPath,
      project_duration_days: projectEnd,
      critical_path_graph: graph
    };
  }

  /**
   * Detect schedule delays and auto-reschedule
   */
  static async detectDelaysAndReschedule(projectId) {
    console.log('[Whip] Detecting delays and rescheduling...');

    const milestones = await getProjectMilestones(projectId);
    const delays = [];

    for (const milestone of milestones) {
      if (milestone.status === 'in_progress' && milestone.planned_end_date) {
        const today = new Date();
        const plannedEnd = new Date(milestone.planned_end_date);

        if (today > plannedEnd) {
          const daysLate = Math.ceil((today - plannedEnd) / (1000 * 60 * 60 * 24));
          delays.push({
            milestone_id: milestone.milestone_id,
            milestone_name: milestone.milestone_name,
            days_late: daysLate,
            planned_end: milestone.planned_end_date
          });
        }
      }
    }

    if (delays.length > 0) {
      console.log(`[Whip] Detected ${delays.length} delayed milestones`);

      // Reschedule dependent tasks
      for (const delay of delays) {
        // Find all milestones that depend on this one
        const dependentMilestones = milestones.filter(m =>
          (m.depends_on || []).includes(delay.milestone_id) && m.status === 'pending'
        );

        for (const dependent of dependentMilestones) {
          // Push out start date by number of days late
          const newStart = new Date(dependent.planned_start_date);
          newStart.setDate(newStart.getDate() + delay.days_late);

          const newEnd = new Date(dependent.planned_end_date);
          newEnd.setDate(newEnd.getDate() + delay.days_late);

          await db.query(`
            UPDATE project_milestones
            SET planned_start_date = $1, planned_end_date = $2
            WHERE project_id = $3 AND milestone_id = $4
          `, [newStart, newEnd, projectId, dependent.milestone_id]);

          console.log(`[Whip] Rescheduled ${dependent.milestone_name}: +${delay.days_late} days`);
        }
      }

      await logAgentActivity(
        projectId,
        'whip',
        'detect_delays_reschedule',
        `Detected ${delays.length} delays and rescheduled dependent tasks`,
        { delays },
        { rescheduled_count: delays.length },
        'completed'
      );
    }

    return {
      success: true,
      delays_detected: delays.length,
      delays
    };
  }
}

// ========================================
// 5. THE SENTINEL (Vision/QC Inspector)
// Context-aware code compliance checking
// ========================================
class SentinelAgent {
  /**
   * Check code compliance based on project type
   * Context: For New Build, check IRC/IBC. For Kitchen, check NEC.
   */
  static async performCodeCheck(projectId, milestoneId, photoUrls) {
    console.log(`[Sentinel] Performing code check for milestone ${milestoneId}...`);

    const template = await getProjectTemplate(projectId);
    const applicableCodes = template.applicable_codes || [];

    // Get milestone details
    const milestone = await db.query(
      'SELECT * FROM project_milestones WHERE project_id = $1 AND milestone_id = $2',
      [projectId, milestoneId]
    );

    if (milestone.rows.length === 0) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const currentMilestone = milestone.rows[0];

    // Context-aware code checking
    let codeCheckPrompt = '';

    if (milestoneId.includes('electrical')) {
      codeCheckPrompt = `
        You are a certified Electrical Inspector reviewing work for NEC (National Electrical Code) compliance.

        Check for:
        - Proper wire gauge for circuit amperage
        - Correct outlet spacing (kitchen requires outlet every 4 feet)
        - GFCI protection in wet areas (kitchen, bathroom, garage)
        - Proper grounding
        - Wire secured within 12" of boxes
        - No more than 360° of bends in conduit runs

        Analyze these photos and report any violations.
      `;
    } else if (milestoneId.includes('framing')) {
      codeCheckPrompt = `
        You are a certified Structural Inspector reviewing work for IRC/IBC compliance.

        Check for:
        - Proper stud spacing (16" or 24" on center)
        - Header sizes over openings (windows, doors)
        - Proper nailing patterns
        - Lateral bracing installed
        - Hurricane ties/straps at rafter connections
        - Fire blocking in walls

        Analyze these photos and report any violations.
      `;
    } else if (milestoneId.includes('plumbing')) {
      codeCheckPrompt = `
        You are a certified Plumbing Inspector reviewing work for IPC (International Plumbing Code) compliance.

        Check for:
        - Proper pipe sizing
        - Vent sizing and placement
        - Trap requirements
        - Pipe support/strapping
        - Water hammer arrestors where required
        - Shutoff valves accessible

        Analyze these photos and report any violations.
      `;
    } else {
      codeCheckPrompt = `
        You are a certified Building Inspector reviewing construction work.
        Analyze these photos for any obvious code violations or quality issues.
      `;
    }

    try {
      // Use GPT-4o Vision to analyze photos
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: codeCheckPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Inspect these photos for milestone: ${currentMilestone.milestone_name}. Applicable codes: ${applicableCodes.join(', ')}`
              },
              ...photoUrls.map(url => ({
                type: 'image_url',
                image_url: { url }
              }))
            ]
          }
        ],
        max_tokens: 1000
      });

      const inspectionReport = response.choices[0].message.content;

      // Store inspection results
      await db.query(`
        UPDATE project_milestones
        SET inspection_notes = $1,
            inspection_status = $2
        WHERE project_id = $3 AND milestone_id = $4
      `, [
        inspectionReport,
        inspectionReport.toLowerCase().includes('violation') ? 'failed' : 'passed',
        projectId,
        milestoneId
      ]);

      await logAgentActivity(
        projectId,
        'sentinel',
        'code_check',
        `Performed ${applicableCodes.join(', ')} code check for ${milestoneId}`,
        { milestone_id: milestoneId, photos_analyzed: photoUrls.length },
        { inspection_report: inspectionReport },
        'completed'
      );

      console.log('[Sentinel] Code check complete');

      return {
        success: true,
        inspection_report: inspectionReport,
        photos_analyzed: photoUrls.length,
        applicable_codes: applicableCodes
      };
    } catch (error) {
      console.error('[Sentinel] Code check failed:', error);
      throw error;
    }
  }
}

// ========================================
// Export all agents
// ========================================
module.exports = {
  OrchestratorAgent,
  VisionaryAgent,
  SharkAgent,
  WhipAgent,
  SentinelAgent,

  // Helper functions
  getProjectTemplate,
  getProjectMilestones,
  logAgentActivity
};
