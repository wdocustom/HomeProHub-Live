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
  static async analyzeBlueprints(projectId, blueprintPDFUrl) {
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
   * ENHANCED: Now creates trade opportunities for contractors
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
    const opportunitiesCreated = [];

    for (const trade of requiredTrades) {
      // Map trade names to database values
      const tradeMapping = {
        'Plumber': 'plumbing',
        'Electrician': 'electrical',
        'General Contractor': 'general_contractor',
        'Mechanical Contractor': 'hvac',
        'Framing': 'framing',
        'Concrete': 'concrete',
        'Roofing': 'roofing'
      };

      const mappedTrade = tradeMapping[trade] || trade.toLowerCase().replace(/\s+/g, '_');

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

      console.log(`[Shark] Found ${result.rows.length} contractors for ${trade}`);

      // STEP 4: Create trade opportunities for each contractor found
      for (const contractor of result.rows) {
        try {
          // Determine which milestone this trade is needed for
          const relevantMilestone = upcomingMilestones.find(m =>
            m.milestone_id.includes(mappedTrade) ||
            m.milestone_name.toLowerCase().includes(trade.toLowerCase())
          ) || upcomingMilestones[0];

          // Prepare project details filtered for this trade
          const projectDetails = {
            project_title: template.title,
            address: template.address || 'Address available upon acceptance',
            homeowner_name: 'Homeowner', // To be filled from actual data
            milestone_name: relevantMilestone?.milestone_name || 'Trade Work',
            estimated_start: relevantMilestone?.planned_start_date || null,
            blueprint_urls: template.blueprints_url ? [template.blueprints_url] : [],
            trade_specific_notes: `${trade} work required for ${template.template_name}`,
            template_type: template.template_type,
            project_scope: template.description || ''
          };

          // Create scope of work description
          const scopeOfWork = `${trade} services needed for ${template.template_type} project. ${
            relevantMilestone ?
            `Specifically for milestone: ${relevantMilestone.milestone_name}` :
            'General trade services required.'
          }`;

          // Set expiration (7 days from now)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          // Insert trade opportunity
          const opportunityResult = await db.query(`
            INSERT INTO autogc_trade_opportunities (
              project_id,
              milestone_id,
              contractor_id,
              contractor_email,
              trade_type,
              scope_of_work,
              project_details,
              expires_at,
              priority_level,
              created_by_agent,
              agent_metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (project_id, contractor_id, milestone_id) DO UPDATE
            SET
              scope_of_work = EXCLUDED.scope_of_work,
              project_details = EXCLUDED.project_details,
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()
            RETURNING id
          `, [
            projectId,
            relevantMilestone?.milestone_id || null,
            contractor.id,
            contractor.email,
            mappedTrade,
            scopeOfWork,
            JSON.stringify(projectDetails),
            expiresAt,
            5, // default priority
            'shark',
            JSON.stringify({
              shark_run_timestamp: new Date().toISOString(),
              contractor_rating: contractor.avg_rating,
              contractor_review_count: contractor.review_count
            })
          ]);

          opportunitiesCreated.push({
            opportunity_id: opportunityResult.rows[0].id,
            contractor_email: contractor.email,
            contractor_name: `${contractor.first_name} ${contractor.last_name}`,
            trade: mappedTrade,
            milestone: relevantMilestone?.milestone_id
          });

          console.log(`[Shark] Created opportunity for ${contractor.email} (${trade})`);
        } catch (error) {
          console.error(`[Shark] Error creating opportunity for ${contractor.email}:`, error);
        }
      }

      searchResults.push({
        trade,
        contractors_found: result.rows.length,
        contractors: result.rows
      });
    }

    // STEP 5: Log procurement activity
    await logAgentActivity(
      projectId,
      'shark',
      'hunt_contractors',
      `Hunted for ${requiredTrades.length} trade types and created ${opportunitiesCreated.length} opportunities`,
      { required_trades: requiredTrades },
      {
        search_results: searchResults,
        opportunities_created: opportunitiesCreated
      },
      'completed'
    );

    return {
      success: true,
      required_trades: requiredTrades,
      search_results: searchResults,
      opportunities_created: opportunitiesCreated,
      total_contractors_found: searchResults.reduce((sum, r) => sum + r.contractors_found, 0),
      total_opportunities_sent: opportunitiesCreated.length
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
// 5. THE DIPLOMAT (Communication & SMS Handler)
// Text-to-Log: Parse SMS from contractors and route to projects
// ========================================
class DiplomatAgent {
  /**
   * Parse incoming SMS message using GPT-4o
   * Extracts intent, summary, and milestone_id
   */
  static async parseSMS(smsBody, contractorPhone, projectId = null) {
    console.log(`[Diplomat] Parsing SMS from ${contractorPhone}...`);

    const systemPrompt = `You are a Construction Assistant. Parse SMS messages from subcontractors working on construction projects.

Extract the following information:
1. intent: One of: 'update', 'blocker', 'question', 'milestone_claim', 'other'
   - 'update': Progress update (e.g., "Framing is 50% done")
   - 'blocker': Issue preventing progress (e.g., "Need dumpster emptied", "Missing materials")
   - 'question': Asking for information or clarification
   - 'milestone_claim': Claiming a milestone is complete (e.g., "Rough-in complete", "Framing done")
   - 'other': Doesn't fit above categories

2. summary: Clean, professional summary of the message (1-2 sentences)

3. milestone_id: If they mention a specific phase/milestone, extract it. Common milestones:
   - excavation, foundation, framing, rough_in, electrical, plumbing, hvac, insulation,
   - drywall, finish, cabinets, countertops, flooring, painting, punchlist

4. urgency: 'low', 'medium', 'high' (based on tone and content)

Return ONLY valid JSON in this exact format:
{
  "intent": "update|blocker|question|milestone_claim|other",
  "summary": "Clean summary here",
  "milestone_id": "milestone_name or null",
  "urgency": "low|medium|high"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Parse this SMS: "${smsBody}"`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content);

      console.log(`[Diplomat] Parsed intent: ${parsed.intent}, milestone: ${parsed.milestone_id || 'none'}`);

      return {
        success: true,
        parsed
      };
    } catch (error) {
      console.error('[Diplomat] SMS parsing failed:', error);
      return {
        success: false,
        error: error.message,
        parsed: {
          intent: 'other',
          summary: smsBody,
          milestone_id: null,
          urgency: 'medium'
        }
      };
    }
  }

  /**
   * Route SMS to correct project based on contractor phone
   * Returns contractor_id and active project_id
   */
  static async routeSMS(fromPhone) {
    console.log(`[Diplomat] Routing SMS from ${fromPhone}...`);

    // Look up contractor by phone
    const contractor = await db.query(
      'SELECT * FROM user_profiles WHERE phone = $1 AND role = $2',
      [fromPhone, 'contractor']
    );

    if (contractor.rows.length === 0) {
      return {
        success: false,
        error: 'unrecognized_sender',
        message: 'Phone number not registered as a contractor'
      };
    }

    const contractorData = contractor.rows[0];

    // Find active project assignment
    const assignment = await db.query(`
      SELECT cpa.*, j.title as project_title, j.address as project_address
      FROM contractor_project_assignments cpa
      JOIN job_postings j ON cpa.project_id = j.id
      WHERE cpa.contractor_id = $1
        AND cpa.status = 'active'
        AND j.status IN ('in_progress', 'active')
      ORDER BY cpa.assigned_at DESC
      LIMIT 1
    `, [contractorData.id]);

    if (assignment.rows.length === 0) {
      return {
        success: false,
        error: 'no_active_project',
        contractor_id: contractorData.id,
        contractor_name: `${contractorData.first_name} ${contractorData.last_name}`,
        message: 'No active project found for this contractor'
      };
    }

    const projectAssignment = assignment.rows[0];

    return {
      success: true,
      contractor_id: contractorData.id,
      contractor_email: contractorData.email,
      contractor_name: `${contractorData.first_name} ${contractorData.last_name}`,
      project_id: projectAssignment.project_id,
      project_title: projectAssignment.project_title,
      project_address: projectAssignment.project_address,
      trade_type: projectAssignment.trade_type
    };
  }

  /**
   * Log SMS to project_logs and trigger appropriate actions
   */
  static async logSMSToProject(projectId, contractorId, smsBody, parsedData, contractorPhone) {
    console.log(`[Diplomat] Logging SMS to project ${projectId}...`);

    const { intent, summary, milestone_id, urgency } = parsedData;

    // Determine if verification is required
    const requiresVerification = intent === 'milestone_claim';

    // Insert into project_logs
    const logResult = await db.query(`
      INSERT INTO project_logs (
        project_id, entry_text, source, created_by_email,
        sms_from_phone, sms_parsed_intent, sms_raw_body,
        requires_verification, metadata
      )
      VALUES ($1, $2, $3, (SELECT email FROM user_profiles WHERE id = $4), $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      projectId,
      summary,
      'sms',
      contractorId,
      contractorPhone,
      intent,
      smsBody,
      requiresVerification,
      JSON.stringify({ milestone_id, urgency })
    ]);

    const logEntry = logResult.rows[0];

    // Log AI agent activity
    await logAgentActivity(
      projectId,
      'diplomat',
      'log_sms',
      `Logged SMS from contractor: ${intent}`,
      { sms_body: smsBody, contractor_phone: contractorPhone },
      { parsed: parsedData, log_id: logEntry.id },
      'completed'
    );

    return {
      success: true,
      log_id: logEntry.id,
      requires_verification: requiresVerification,
      parsed: parsedData
    };
  }

  /**
   * Generate verification link for milestone claim
   */
  static async generateVerificationLink(projectId, milestoneId, contractorId, projectLogId) {
    console.log(`[Diplomat] Generating verification link for milestone ${milestoneId}...`);

    // Generate short secure token (8 characters)
    const crypto = require('crypto');
    const token = crypto.randomBytes(4).toString('hex'); // 8 character hex string

    // Insert verification token
    await db.query(`
      INSERT INTO verification_tokens (
        token, project_id, milestone_id, contractor_id, project_log_id, token_type, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [token, projectId, milestoneId, contractorId, projectLogId, 'milestone_verification', 'pending']);

    // Update project_log with token
    await db.query(`
      UPDATE project_logs
      SET verification_link_token = $1, verification_sent_at = NOW()
      WHERE id = $2
    `, [token, projectLogId]);

    // Construct verification URL (update with your actual domain)
    const baseUrl = process.env.BASE_URL || 'https://homeprohub.today';
    const verificationUrl = `${baseUrl}/verify/${token}`;

    return {
      success: true,
      token,
      verification_url: verificationUrl
    };
  }
  
  /**
   * Send SMS message to contractor using Twilio
   * @param {string} toPhone - Phone number to send SMS to
   * @param {string} body - Message body
   * @param {string} projectId - Optional project ID for logging
   * @returns {Object} - Twilio response or error
   */
  static async sendSMS(toPhone, body, projectId = null) {
    console.log(`[Diplomat] Sending SMS to ${toPhone}...`);
    
    try {
      // Check if Twilio is configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        throw new Error('Twilio credentials not configured');
      }
      
      // Initialize Twilio client
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      // Send message via Twilio
      const message = await client.messages.create({
        body: body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toPhone
      });
      
      console.log(`[Diplomat] SMS sent successfully: ${message.sid}`);
      
      // Log the outbound SMS if project ID is provided
      if (projectId) {
        await db.query(`
          INSERT INTO sms_routing_log (
            message_sid, from_phone, to_phone, message_body, direction, processed, 
            routing_status, contractor_id, project_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 
            (SELECT id FROM user_profiles WHERE phone = $3 LIMIT 1),
            $8
          )
        `, [
          message.sid,
          process.env.TWILIO_PHONE_NUMBER,
          toPhone,
          body,
          'outbound',
          true,
          'sent',
          projectId
        ]);
      }
      
      return {
        success: true,
        message_sid: message.sid,
        status: message.status
      };
      
    } catch (error) {
      console.error(`[Diplomat] Error sending SMS:`, error);
      
      // Log the error if project ID is provided
      if (projectId) {
        await db.query(`
          INSERT INTO sms_routing_log (
            from_phone, to_phone, message_body, direction, processed, 
            routing_status, contractor_id, project_id, error_message
          )
          VALUES ($1, $2, $3, $4, $5, $6,
            (SELECT id FROM user_profiles WHERE phone = $2 LIMIT 1),
            $7, $8
          )
        `, [
          process.env.TWILIO_PHONE_NUMBER || 'unknown',
          toPhone,
          body,
          'outbound',
          false,
          'error',
          projectId,
          error.message
        ]);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Send a verification link for milestone claim to a contractor
   * @param {number} projectId - Project ID
   * @param {number} milestoneId - Milestone ID
   * @param {number} contractorId - Contractor ID
   * @param {number} projectLogId - Project Log ID for the milestone claim
   * @param {string} contractorPhone - Contractor's phone number
   * @returns {Object} - Result of the operation
   */
  static async sendVerificationLink(projectId, milestoneId, contractorId, projectLogId, contractorPhone) {
    console.log(`[Diplomat] Sending verification link to contractor ${contractorId} for milestone ${milestoneId}...`);
    
    try {
      // Get milestone details
      const milestoneResult = await db.query(`
        SELECT m.title, m.points, p.title as project_title
        FROM project_milestones m
        JOIN projects p ON m.project_id = p.id
        WHERE m.id = $1 AND m.project_id = $2
      `, [milestoneId, projectId]);
      
      if (milestoneResult.rows.length === 0) {
        throw new Error('Milestone not found');
      }
      
      const milestone = milestoneResult.rows[0];
      
      // Generate verification link
      const verificationResult = await this.generateVerificationLink(
        projectId, 
        milestoneId, 
        contractorId, 
        projectLogId
      );
      
      if (!verificationResult.success) {
        throw new Error('Failed to generate verification link');
      }
      
      // Format the SMS message
      const message = `HomeProHub: Milestone "${milestone.title}" noted for ${milestone.project_title}. Tap here to verify and unlock payment: ${verificationResult.verification_url}`;
      
      // Send the SMS
      const smsResult = await this.sendSMS(contractorPhone, message, projectId);
      
      if (!smsResult.success) {
        throw new Error(`Failed to send SMS: ${smsResult.error}`);
      }
      
      // Update project_log with SMS sent status
      await db.query(`
        UPDATE project_logs
        SET verification_sms_sent = TRUE, 
            verification_sms_sent_at = NOW(),
            verification_sms_sid = $1
        WHERE id = $2
      `, [smsResult.message_sid, projectLogId]);
      
      return {
        success: true,
        message: 'Verification link sent successfully',
        verification_url: verificationResult.verification_url,
        sms_sid: smsResult.message_sid
      };
      
    } catch (error) {
      console.error(`[Diplomat] Error sending verification link:`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// ========================================
// 6. THE SENTINEL (Vision/QC Inspector)
// Context-aware code compliance checking + Forensic Analysis
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

  /**
   * PHASE 5: Forensic Analysis - Anti-Deepfake Detection
   * Analyzes photo for AI-generated content, screen captures, and fraud indicators
   */
  static async performForensicAnalysis(photoUrl, milestoneRequirements = null) {
    console.log('[Sentinel] Performing forensic analysis on photo...');

    const forensicPrompt = `You are a Forensic Photo Analysis AI specialized in detecting fraudulent construction documentation.

Your job is to analyze construction site photos for authenticity and detect fraud attempts.

FORENSIC CHECKS TO PERFORM:

1. AI-Generated Detection:
   - Look for signs of AI/CGI generation (unnatural textures, impossible geometry, lighting inconsistencies)
   - Check for "too perfect" details or synthetic patterns
   - Verify realistic material properties (wood grain, concrete texture, metal surfaces)

2. Screen Capture Detection:
   - Look for moiré patterns (interference patterns from photographing a screen)
   - Check for screen bezels, reflections, or digital artifacts
   - Verify natural lighting vs. screen backlight

3. Photo Manipulation:
   - Check for clone stamp artifacts
   - Look for inconsistent shadows or lighting
   - Verify perspective consistency

4. Authenticity Indicators (POSITIVE SIGNS):
   - Natural lighting with appropriate shadows
   - Realistic depth of field
   - Authentic material textures
   - Construction site messiness (sawdust, debris, tools)
   - Weather/environmental effects
   - EXIF data presence (if available)

5. Quality Check:
${milestoneRequirements ? `
   Milestone-specific requirements: ${milestoneRequirements}
   - Verify all required elements are visible
   - Check work quality meets standards
` : '   - General construction work quality assessment'}

RETURN JSON in this EXACT format:
{
  "is_authentic": true/false,
  "confidence": 0.0-1.0,
  "fraud_indicators": ["list of suspicious findings"],
  "authenticity_indicators": ["list of positive signs"],
  "ai_generated_probability": 0.0-1.0,
  "screen_capture_detected": true/false,
  "manipulation_detected": true/false,
  "quality_assessment": {
    "meets_requirements": true/false,
    "observations": ["list of observations"],
    "issues": ["list of issues if any"]
  },
  "recommendation": "approved|rejected|needs_clarification",
  "reasoning": "Brief explanation of decision"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: forensicPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Perform forensic analysis on this construction site photo:'
              },
              {
                type: 'image_url',
                image_url: { url: photoUrl }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.2
      });

      const forensicResult = JSON.parse(response.choices[0].message.content);

      console.log(`[Sentinel] Forensic analysis complete: ${forensicResult.recommendation}`);

      return {
        success: true,
        forensic_result: forensicResult
      };
    } catch (error) {
      console.error('[Sentinel] Forensic analysis failed:', error);
      return {
        success: false,
        error: error.message,
        forensic_result: {
          is_authentic: false,
          confidence: 0,
          recommendation: 'error',
          reasoning: 'Analysis failed due to technical error'
        }
      };
    }
  }

  /**
   * Complete Evidence Verification
   * Combines GPS validation, forensic analysis, and quality checks
   */
  static async verifyEvidence(evidenceId) {
    console.log(`[Sentinel] Verifying evidence ${evidenceId}...`);

    const startTime = Date.now();

    // Get evidence record
    const evidenceResult = await db.query(
      'SELECT * FROM project_evidence WHERE id = $1',
      [evidenceId]
    );

    if (evidenceResult.rows.length === 0) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const evidence = evidenceResult.rows[0];

    // Get milestone details for context
    let milestoneRequirements = null;
    if (evidence.milestone_id) {
      const milestoneResult = await db.query(
        'SELECT * FROM project_milestones WHERE id = $1',
        [evidence.milestone_id]
      );
      if (milestoneResult.rows.length > 0) {
        const milestone = milestoneResult.rows[0];
        milestoneRequirements = `Milestone: ${milestone.milestone_name}`;
      }
    }

    // STEP 1: Perform forensic analysis
    const forensicAnalysis = await this.performForensicAnalysis(
      evidence.photo_url,
      milestoneRequirements
    );

    // STEP 2: Determine overall result
    let verificationResult = 'pending';
    let rejectionReason = null;

    const forensicData = forensicAnalysis.forensic_result;

    // Check location verification
    if (!evidence.location_verified) {
      verificationResult = 'rejected';
      rejectionReason = 'GPS location does not match job site';
    }
    // Check forensic analysis
    else if (!forensicData.is_authentic || forensicData.confidence < 0.6) {
      verificationResult = 'rejected';
      rejectionReason = `Photo failed authenticity check: ${forensicData.reasoning}`;
    }
    else if (forensicData.screen_capture_detected) {
      verificationResult = 'rejected';
      rejectionReason = 'Screen capture detected - live photo required';
    }
    else if (forensicData.ai_generated_probability > 0.3) {
      verificationResult = 'rejected';
      rejectionReason = 'AI-generated content detected';
    }
    else if (forensicData.recommendation === 'rejected') {
      verificationResult = 'rejected';
      rejectionReason = forensicData.reasoning;
    }
    else if (forensicData.recommendation === 'needs_clarification') {
      verificationResult = 'needs_resubmission';
      rejectionReason = forensicData.reasoning;
    }
    else if (forensicData.recommendation === 'approved' && forensicData.quality_assessment.meets_requirements) {
      verificationResult = 'approved';
    }
    else {
      verificationResult = 'needs_resubmission';
      rejectionReason = 'Quality check inconclusive';
    }

    const processingTime = Date.now() - startTime;

    // STEP 3: Update evidence record
    await db.query(`
      UPDATE project_evidence
      SET
        forensic_analysis_status = $1,
        forensic_checks = $2,
        quality_check_status = $3,
        quality_check_result = $4,
        verification_result = $5,
        rejection_reason = $6,
        processed_by_agent = 'sentinel',
        agent_processing_time_ms = $7,
        processed_at = NOW(),
        approved_at = CASE WHEN $5 = 'approved' THEN NOW() ELSE NULL END
      WHERE id = $8
    `, [
      'passed',
      JSON.stringify({
        is_authentic: forensicData.is_authentic,
        confidence: forensicData.confidence,
        ai_generated_probability: forensicData.ai_generated_probability,
        screen_capture_detected: forensicData.screen_capture_detected,
        manipulation_detected: forensicData.manipulation_detected,
        fraud_indicators: forensicData.fraud_indicators,
        authenticity_indicators: forensicData.authenticity_indicators
      }),
      forensicData.recommendation === 'approved' ? 'approved' : 'rejected',
      JSON.stringify(forensicData.quality_assessment),
      verificationResult,
      rejectionReason,
      processingTime,
      evidenceId
    ]);

    // STEP 4: Update milestone if approved
    if (verificationResult === 'approved' && evidence.milestone_id) {
      await db.query(`
        UPDATE project_milestones
        SET
          verification_status = 'approved',
          verification_approved_at = NOW(),
          status = CASE WHEN status = 'inspection_pending' THEN 'inspection_passed' ELSE status END
        WHERE id = $1
      `, [evidence.milestone_id]);

      // Log agent activity
      await logAgentActivity(
        evidence.project_id,
        'sentinel',
        'verify_evidence',
        `Evidence approved for milestone`,
        { evidence_id: evidenceId },
        { verification_result: verificationResult, forensic_data: forensicData },
        'completed'
      );
    }

    console.log(`[Sentinel] Evidence verification complete: ${verificationResult}`);

    return {
      success: true,
      verification_result: verificationResult,
      rejection_reason: rejectionReason,
      forensic_analysis: forensicData,
      processing_time_ms: processingTime
    };
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
  DiplomatAgent,
  SentinelAgent,

  // Helper functions
  getProjectTemplate,
  getProjectMilestones,
  logAgentActivity
};
