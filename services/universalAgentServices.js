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
const { supabase, logAIAgentActivity: dbLogAIAgentActivity } = require('../database/db');
const { convertPDFToImages, isPDFUrl } = require('./blueprintProcessor');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========================================
// Helper: Get Project Template
// ========================================
async function getProjectTemplate(projectId) {
  // Fetch job posting with template details
  const { data: job, error: jobError } = await supabase
    .from('job_postings')
    .select(`
      id,
      title,
      template_id,
      blueprints_url,
      project_metadata,
      address,
      description,
      homeowner_email,
      status,
      project_templates (*)
    `)
    .eq('id', projectId)
    .single();

  if (jobError) {
    throw new Error(`Project ${projectId} not found: ${jobError.message}`);
  }

  // Flatten the structure to match the old format
  const template = job.project_templates || {};
  delete job.project_templates;

  return {
    ...template,
    project_id: job.id,
    title: job.title,
    template_id: job.template_id,
    blueprints_url: job.blueprints_url,
    project_metadata: job.project_metadata,
    address: job.address,
    description: job.description,
    homeowner_email: job.homeowner_email,
    status: job.status
  };
}

// ========================================
// Helper: Get Project Milestones
// ========================================
async function getProjectMilestones(projectId) {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('milestone_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch milestones: ${error.message}`);
  }

  return data || [];
}

// ========================================
// Helper: Log AI Agent Activity
// ========================================
async function logAgentActivity(projectId, agentType, actionType, actionDescription, inputData, outputData, status = 'completed') {
  // Use the database helper function if available
  if (dbLogAIAgentActivity) {
    return await dbLogAIAgentActivity({
      project_id: projectId,
      agent_type: agentType,
      action_type: actionType,
      action_description: actionDescription,
      input_data: inputData,
      output_data: outputData,
      status: status
    });
  }

  // Fallback to direct Supabase call
  const { data, error } = await supabase
    .from('ai_agent_activity')
    .insert({
      project_id: projectId,
      agent_type: agentType,
      action_type: actionType,
      action_description: actionDescription,
      input_data: inputData,
      output_data: outputData,
      status: status,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (error) {
    console.error('[logAgentActivity] Error:', error);
    throw new Error(`Failed to log agent activity: ${error.message}`);
  }

  return data;
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

    // Get template milestones using Supabase
    const { data: templateMilestones, error: tmError } = await supabase
      .from('template_milestones')
      .select('*')
      .eq('template_id', template.template_id)
      .order('milestone_order', { ascending: true });

    if (tmError) {
      throw new Error(`Failed to fetch template milestones: ${tmError.message}`);
    }

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

      milestone.planned_start_date = new Date(Date.now() + startOffset * 24 * 60 * 60 * 1000).toISOString();
      milestone.planned_end_date = new Date(new Date(milestone.planned_start_date).getTime() + phase.estimated_days * 24 * 60 * 60 * 1000).toISOString();

      projectMilestones.push(milestone);
    }

    // Insert all milestones using Supabase upsert
    if (projectMilestones.length > 0) {
      const { error: insertError } = await supabase
        .from('project_milestones')
        .upsert(projectMilestones, {
          onConflict: 'project_id,milestone_id',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('[Orchestrator] Error inserting milestones:', insertError);
        throw new Error(`Failed to insert milestones: ${insertError.message}`);
      }
    }

    // Initialize project state using Supabase upsert
    if (phases.length > 0) {
      const { error: stateError } = await supabase
        .from('project_states')
        .upsert({
          project_id: projectId,
          current_phase: phases[0].phase_id,
          current_milestone_id: phases[0].phase_id
        }, { onConflict: 'project_id' });

      if (stateError) {
        console.error('[Orchestrator] Error initializing project state:', stateError);
      }
    }

    await logAgentActivity(
      projectId,
      'orchestrator',
      'initialize_project',
      `Initialized project with ${projectMilestones.length} milestones from template ${template.template_name || template.name || 'unknown'}`,
      { template_id: template.template_id, template_name: template.template_name || template.name },
      { milestones_created: projectMilestones.length },
      'completed'
    );

    console.log(`[Orchestrator] Created ${projectMilestones.length} milestones for project`);

    return {
      success: true,
      milestones_created: projectMilestones.length,
      template: template.template_name || template.name || 'unknown'
    };
  }

  /**
   * Advance to next milestone
   * Checks dependencies before advancing
   */
  static async advanceToNextMilestone(projectId, currentMilestoneId) {
    console.log(`[Orchestrator] Attempting to advance from milestone ${currentMilestoneId}...`);

    // Mark current milestone as completed using Supabase
    const { error: updateError } = await supabase
      .from('project_milestones')
      .update({
        status: 'completed',
        actual_end_date: new Date().toISOString().split('T')[0]
      })
      .eq('project_id', projectId)
      .eq('milestone_id', currentMilestoneId);

    if (updateError) {
      console.error('[Orchestrator] Error marking milestone as completed:', updateError);
    }

    // Get next milestone using Supabase
    const { data: nextMilestones, error: fetchError } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('milestone_order', { ascending: true })
      .limit(1);

    if (fetchError) {
      throw new Error(`Failed to fetch next milestone: ${fetchError.message}`);
    }

    if (!nextMilestones || nextMilestones.length === 0) {
      console.log('[Orchestrator] No more milestones - project complete!');
      return { success: true, completed: true };
    }

    const nextMilestone = nextMilestones[0];

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

    // Update project state using Supabase
    const { error: stateError } = await supabase
      .from('project_states')
      .update({
        current_phase: nextMilestone.milestone_id,
        current_milestone_id: nextMilestone.milestone_id,
        last_activity_date: new Date().toISOString()
      })
      .eq('project_id', projectId);

    if (stateError) {
      console.error('[Orchestrator] Error updating project state:', stateError);
    }

    // Update milestone status using Supabase
    const { error: milestoneError } = await supabase
      .from('project_milestones')
      .update({
        status: 'in_progress',
        actual_start_date: new Date().toISOString().split('T')[0]
      })
      .eq('project_id', projectId)
      .eq('milestone_id', nextMilestone.milestone_id);

    if (milestoneError) {
      console.error('[Orchestrator] Error updating milestone status:', milestoneError);
    }

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

    // Fetch completed milestones that match dependencies using Supabase
    const { data, error } = await supabase
      .from('project_milestones')
      .select('milestone_id')
      .eq('project_id', projectId)
      .in('milestone_id', dependencies)
      .eq('status', 'completed');

    if (error) {
      console.error('[Orchestrator] Error checking dependencies:', error);
      return false;
    }

    return data.length === dependencies.length;
  }

  /**
   * Process field update from Twilio webhook
   * Analyzes text, determines intent, and triggers appropriate actions
   * Part of Zero-App Protocol
   */
  static async processFieldUpdate(projectId, updateText) {
    console.log(`[Orchestrator] Processing field update for project ${projectId}...`);

    try {
      // Get current project milestones
      const { data: milestones, error: milestoneError } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('milestone_order', { ascending: true });

      if (milestoneError) {
        console.error('[Orchestrator] Failed to fetch milestones:', milestoneError);
      }

      const currentMilestone = milestones?.find(m => m.status === 'in_progress') || milestones?.[0];

      // Classify the intent using GPT
      const intent = await this.classifyIntent(updateText, currentMilestone);

      console.log(`[Orchestrator] Classified intent: ${intent.type}`);

      // Handle based on intent
      let updateResult = {
        success: true,
        notifyHomeowner: false,
        summary: intent.summary
      };

      switch (intent.type) {
        case 'progress':
          updateResult = await this.handleProgress(projectId, currentMilestone, intent);
          break;

        case 'blocker':
          updateResult = await this.handleBlocker(projectId, intent);
          break;

        case 'milestone_complete':
          updateResult = await this.handleMilestoneComplete(projectId, currentMilestone, intent);
          break;

        default:
          updateResult.summary = intent.summary;
          updateResult.notifyHomeowner = false;
      }

      return updateResult;
    } catch (error) {
      console.error('[Orchestrator] Processing failed:', error);
      return {
        success: false,
        error: error.message,
        notifyHomeowner: false,
        summary: 'Failed to process update'
      };
    }
  }

  /**
   * Classify the intent of a field update
   */
  static async classifyIntent(text, currentMilestone) {
    const systemPrompt = `You are a Construction Project Coordinator. Classify field updates into intent categories.

Current milestone: ${currentMilestone?.milestone_name || 'Unknown'}

Classify the intent as:
- "progress": Work is advancing (e.g., "50% done", "Started framing", "Making good progress")
- "blocker": Issue preventing work (e.g., "Need materials", "Waiting for inspection", "Problem with...")
- "milestone_complete": Phase is finished (e.g., "Framing done", "Ready for inspection", "Completed rough-in")
- "question": Asking for info
- "other": Doesn't fit above

Return JSON:
{
  "type": "progress|blocker|milestone_complete|question|other",
  "summary": "Brief professional summary in 1 sentence",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this update: "${text}"` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[Orchestrator] Intent classification failed:', error);
      return {
        type: 'other',
        summary: text.substring(0, 200),
        confidence: 0.5
      };
    }
  }

  /**
   * Handle progress updates
   */
  static async handleProgress(projectId, currentMilestone, intent) {
    if (!currentMilestone) {
      return {
        success: true,
        notifyHomeowner: false,
        summary: intent.summary
      };
    }

    // Update milestone status to 'review' if it was 'in_progress'
    if (currentMilestone.status === 'in_progress') {
      const { error } = await supabase
        .from('project_milestones')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', currentMilestone.id);

      if (error) {
        console.error('[Orchestrator] Failed to update milestone:', error);
      } else {
        console.log(`[Orchestrator] Milestone ${currentMilestone.milestone_name} moved to review`);
      }
    }

    return {
      success: true,
      notifyHomeowner: true,
      summary: `${currentMilestone.milestone_name}: ${intent.summary}`
    };
  }

  /**
   * Handle blocker reports
   */
  static async handleBlocker(projectId, intent) {
    console.log(`[Orchestrator] Blocker detected: ${intent.summary}`);

    // Create a risk flag on the project
    const { error } = await supabase
      .from('project_logs')
      .insert({
        project_id: projectId,
        log_type: 'risk',
        message: `BLOCKER: ${intent.summary}`,
        metadata: { intent_type: 'blocker', urgency: 'high' },
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[Orchestrator] Failed to log blocker:', error);
    }

    return {
      success: true,
      notifyHomeowner: true,
      summary: `⚠️ Blocker reported: ${intent.summary}`
    };
  }

  /**
   * Handle milestone completion claims
   */
  static async handleMilestoneComplete(projectId, currentMilestone, intent) {
    if (!currentMilestone) {
      return {
        success: true,
        notifyHomeowner: true,
        summary: `Milestone completion reported: ${intent.summary}`
      };
    }

    // Move to 'review' status for verification
    const { error } = await supabase
      .from('project_milestones')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', currentMilestone.id);

    if (error) {
      console.error('[Orchestrator] Failed to update milestone:', error);
    }

    return {
      success: true,
      notifyHomeowner: true,
      summary: `${currentMilestone.milestone_name} completed and ready for review`
    };
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
      // ===== VISION API IMPLEMENTATION =====
      // Convert PDF to images for Vision analysis
      console.log('[Visionary] Converting PDF to images for Vision API...');

      const blueprintImages = await convertPDFToImages(blueprintPDFUrl, {
        maxPages: 10,  // Analyze up to 10 pages
        scale: 2.0     // High resolution for technical drawings
      });

      console.log(`[Visionary] Analyzing ${blueprintImages.length} blueprint pages with GPT-4o Vision...`);

      // Analyze each page with Vision API
      const pageAnalyses = [];

      for (let i = 0; i < blueprintImages.length; i++) {
        console.log(`[Visionary] Analyzing page ${i + 1}/${blueprintImages.length}...`);

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: analysisPrompt
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this construction blueprint page ${i + 1}. Extract structured data and measurements.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: blueprintImages[i],
                    detail: 'high'  // High resolution analysis for technical drawings
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        });

        const pageAnalysis = JSON.parse(response.choices[0].message.content);
        pageAnalyses.push({
          page: i + 1,
          analysis: pageAnalysis
        });

        console.log(`[Visionary] Page ${i + 1} analyzed successfully`);
      }

      // Merge results from all pages
      console.log('[Visionary] Merging multi-page analysis...');

      const analysis = {
        total_pages: blueprintImages.length,
        blueprint_url: blueprintPDFUrl,
        analyzed_at: new Date().toISOString(),
        template_type: template.template_type,
        pages: pageAnalyses,

        // Merge common data across pages
        summary: {
          square_footage: 0,
          rooms: [],
          features: [],
          materials: {},
          structural_notes: [],
          permit_requirements: []
        }
      };

      // Combine data from all pages
      for (const pageData of pageAnalyses) {
        const page = pageData.analysis;

        // Aggregate square footage
        if (page.square_footage || page.total_square_footage) {
          const sqft = parseInt(page.square_footage || page.total_square_footage || 0);
          if (sqft > analysis.summary.square_footage) {
            analysis.summary.square_footage = sqft;
          }
        }

        // Collect rooms
        if (page.rooms && Array.isArray(page.rooms)) {
          analysis.summary.rooms.push(...page.rooms);
        }

        // Collect features
        if (page.features && Array.isArray(page.features)) {
          analysis.summary.features.push(...page.features);
        } else if (page.special_features && Array.isArray(page.special_features)) {
          analysis.summary.features.push(...page.special_features);
        }

        // Merge materials
        if (page.materials || page.schedule_of_values) {
          Object.assign(analysis.summary.materials, page.materials || page.schedule_of_values || {});
        }

        // Collect structural notes
        if (page.structural_requirements && Array.isArray(page.structural_requirements)) {
          analysis.summary.structural_notes.push(...page.structural_requirements);
        }

        // Collect permit requirements
        if (page.permit_requirements) {
          if (Array.isArray(page.permit_requirements)) {
            analysis.summary.permit_requirements.push(...page.permit_requirements);
          } else {
            analysis.summary.permit_requirements.push(page.permit_requirements);
          }
        }
      }

      // Deduplicate arrays
      analysis.summary.features = [...new Set(analysis.summary.features)];
      analysis.summary.permit_requirements = [...new Set(analysis.summary.permit_requirements)];

      console.log(`[Visionary] ✅ Vision analysis complete: ${analysis.summary.square_footage} sqft, ${analysis.summary.rooms.length} rooms`);

      // Store analysis in project metadata using Supabase
      const { error: updateError } = await supabase
        .from('job_postings')
        .update({
          project_metadata: analysis,
          ai_analysis: `Blueprint analysis completed: ${JSON.stringify(analysis, null, 2)}`
        })
        .eq('id', projectId);

      if (updateError) {
        console.error('[Visionary] Error updating job posting:', updateError);
      }

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

      // Fetch contractors using Supabase
      const { data: contractors, error: contractorError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'contractor')
        .eq('trade', mappedTrade)
        .eq('profile_complete', true)
        .limit(5);

      if (contractorError) {
        console.error(`[Shark] Error fetching contractors for ${trade}:`, contractorError);
        continue;
      }

      const result = { rows: contractors || [] };
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

          // Insert trade opportunity using Supabase upsert
          const { data: opportunityData, error: oppError } = await supabase
            .from('autogc_trade_opportunities')
            .upsert({
              project_id: projectId,
              milestone_id: relevantMilestone?.milestone_id || null,
              contractor_id: contractor.id,
              contractor_email: contractor.email,
              trade_type: mappedTrade,
              scope_of_work: scopeOfWork,
              project_details: projectDetails,
              expires_at: expiresAt.toISOString(),
              priority_level: 5,
              created_by_agent: 'shark',
              agent_metadata: {
                shark_run_timestamp: new Date().toISOString(),
                contractor_rating: contractor.avg_rating || 0,
                contractor_review_count: contractor.review_count || 0
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'project_id,contractor_id,milestone_id'
            })
            .select('id')
            .single();

          if (oppError) {
            console.error(`[Shark] Error creating opportunity for ${contractor.email}:`, oppError);
            continue;
          }

          opportunitiesCreated.push({
            opportunity_id: opportunityData.id,
            contractor_email: contractor.email,
            contractor_name: `${contractor.first_name} ${contractor.last_name}`,
            contractor_phone: contractor.phone,
            trade: mappedTrade,
            milestone: relevantMilestone?.milestone_id
          });

          console.log(`[Shark] Created opportunity for ${contractor.email} (${trade})`);

          // AUTOMATION: Immediately trigger Diplomat to send RFQ SMS
          if (contractor.phone) {
            try {
              await DiplomatAgent.sendRFQInvite(
                projectId,
                contractor.phone,
                mappedTrade,
                projectDetails.zip_code,
                projectDetails.budget_estimate
              );
              console.log(`[Shark→Diplomat] RFQ SMS sent to ${contractor.phone}`);
            } catch (smsError) {
              console.error(`[Shark→Diplomat] SMS failed for ${contractor.phone}:`, smsError.message);
              // Continue even if SMS fails - opportunity is still created
            }
          }
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

    // Update project_states with critical path status using Supabase
    const { error: statusError } = await supabase
      .from('project_states')
      .update({
        critical_path_status: behindSchedule ? 'delayed' : 'on_track'
      })
      .eq('project_id', projectId);

    if (statusError) {
      console.error('[Whip] Error updating critical path status:', statusError);
    }

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

          // Reschedule milestone using Supabase
          const { error: rescheduleError } = await supabase
            .from('project_milestones')
            .update({
              planned_start_date: newStart.toISOString(),
              planned_end_date: newEnd.toISOString()
            })
            .eq('project_id', projectId)
            .eq('milestone_id', dependent.milestone_id);

          if (rescheduleError) {
            console.error(`[Whip] Error rescheduling ${dependent.milestone_name}:`, rescheduleError);
          }

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

    // Look up contractor by phone using Supabase
    const { data: contractors, error: contractorError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('phone', fromPhone)
      .eq('role', 'contractor');

    if (contractorError || !contractors || contractors.length === 0) {
      return {
        success: false,
        error: 'unrecognized_sender',
        message: 'Phone number not registered as a contractor'
      };
    }

    const contractorData = contractors[0];

    // Find active project assignment using Supabase
    const { data: assignments, error: assignmentError } = await supabase
      .from('contractor_project_assignments')
      .select(`
        *,
        job_postings!inner (
          title,
          address,
          status
        )
      `)
      .eq('contractor_id', contractorData.id)
      .eq('status', 'active')
      .in('job_postings.status', ['in_progress', 'active'])
      .order('assigned_at', { ascending: false })
      .limit(1);

    if (assignmentError || !assignments || assignments.length === 0) {
      return {
        success: false,
        error: 'no_active_project',
        contractor_id: contractorData.id,
        contractor_name: `${contractorData.first_name} ${contractorData.last_name}`,
        message: 'No active project found for this contractor'
      };
    }

    const projectAssignment = assignments[0];

    return {
      success: true,
      contractor_id: contractorData.id,
      contractor_email: contractorData.email,
      contractor_name: `${contractorData.first_name} ${contractorData.last_name}`,
      project_id: projectAssignment.project_id,
      project_title: projectAssignment.job_postings?.title || 'Unknown',
      project_address: projectAssignment.job_postings?.address || 'Unknown',
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

    // Get contractor email
    const { data: contractor, error: contractorError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', contractorId)
      .single();

    if (contractorError) {
      console.error('[Diplomat] Error fetching contractor email:', contractorError);
    }

    // Insert into project_logs using Supabase
    const { data: logEntry, error: logError } = await supabase
      .from('project_logs')
      .insert({
        project_id: projectId,
        entry_text: summary,
        source: 'sms',
        created_by_email: contractor?.email || null,
        sms_from_phone: contractorPhone,
        sms_parsed_intent: intent,
        sms_raw_body: smsBody,
        requires_verification: requiresVerification,
        metadata: { milestone_id, urgency }
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to log SMS: ${logError.message}`);
    }

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

    // Insert verification token using Supabase
    const { error: tokenError } = await supabase
      .from('verification_tokens')
      .insert({
        token,
        project_id: projectId,
        milestone_id: milestoneId,
        contractor_id: contractorId,
        project_log_id: projectLogId,
        token_type: 'milestone_verification',
        status: 'pending'
      });

    if (tokenError) {
      console.error('[Diplomat] Error inserting verification token:', tokenError);
    }

    // Update project_log with token using Supabase
    const { error: updateError } = await supabase
      .from('project_logs')
      .update({
        verification_link_token: token,
        verification_sent_at: new Date().toISOString()
      })
      .eq('id', projectLogId);

    if (updateError) {
      console.error('[Diplomat] Error updating project log:', updateError);
    }

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
        // Get contractor ID from phone
        const { data: contractor } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('phone', toPhone)
          .limit(1)
          .single();

        const { error: logError } = await supabase
          .from('sms_routing_log')
          .insert({
            message_sid: message.sid,
            from_phone: process.env.TWILIO_PHONE_NUMBER,
            to_phone: toPhone,
            message_body: body,
            direction: 'outbound',
            processed: true,
            routing_status: 'sent',
            contractor_id: contractor?.id || null,
            project_id: projectId
          });

        if (logError) {
          console.error('[Diplomat] Error logging outbound SMS:', logError);
        }
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
        // Get contractor ID from phone
        const { data: contractor } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('phone', toPhone)
          .limit(1)
          .single();

        const { error: logError } = await supabase
          .from('sms_routing_log')
          .insert({
            from_phone: process.env.TWILIO_PHONE_NUMBER || 'unknown',
            to_phone: toPhone,
            message_body: body,
            direction: 'outbound',
            processed: false,
            routing_status: 'error',
            contractor_id: contractor?.id || null,
            project_id: projectId,
            error_message: error.message
          });

        if (logError) {
          console.error('[Diplomat] Error logging SMS error:', logError);
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send RFQ invitation SMS to contractor (Automated by Shark Agent)
   * @param {string} projectId - Project ID
   * @param {string} contractorPhone - Contractor's phone number
   * @param {string} trade - Trade type (e.g., "plumbing", "electrical")
   * @param {string} zipCode - Project location
   * @param {number} budgetEstimate - Estimated budget (optional)
   */
  static async sendRFQInvite(projectId, contractorPhone, trade, zipCode, budgetEstimate = null) {
    console.log(`[Diplomat] Sending RFQ invite to ${contractorPhone} for ${trade} work...`);

    // Format trade name for human readability
    const tradeDisplay = trade.charAt(0).toUpperCase() + trade.slice(1).replace('_', ' ');

    // Construct SMS body
    const budgetText = budgetEstimate
      ? `Budget: ~$${budgetEstimate.toLocaleString()}. `
      : '';

    const smsBody = `🏗️ New Lead from HomeProHub!\n\n` +
      `Trade: ${tradeDisplay}\n` +
      `Location: ${zipCode}\n` +
      `${budgetText}` +
      `Reply YES to bid or view details: https://homeprohub.today/contractor-dashboard.html`;

    // Send SMS via Twilio
    return await this.sendSMS(contractorPhone, smsBody, projectId);
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
      // Get milestone details using Supabase
      const { data: milestone, error: milestoneError } = await supabase
        .from('project_milestones')
        .select(`
          milestone_name,
          points,
          job_postings!inner (
            title
          )
        `)
        .eq('id', milestoneId)
        .eq('project_id', projectId)
        .single();

      if (milestoneError || !milestone) {
        throw new Error('Milestone not found');
      }

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
      const message = `HomeProHub: Milestone "${milestone.milestone_name}" noted for ${milestone.job_postings?.title || 'project'}. Tap here to verify and unlock payment: ${verificationResult.verification_url}`;

      // Send the SMS
      const smsResult = await this.sendSMS(contractorPhone, message, projectId);

      if (!smsResult.success) {
        throw new Error(`Failed to send SMS: ${smsResult.error}`);
      }

      // Update project_log with SMS sent status using Supabase
      const { error: updateError } = await supabase
        .from('project_logs')
        .update({
          verification_sms_sent: true,
          verification_sms_sent_at: new Date().toISOString(),
          verification_sms_sid: smsResult.message_sid
        })
        .eq('id', projectLogId);

      if (updateError) {
        console.error('[Diplomat] Error updating project log:', updateError);
      }

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

    // Get milestone details using Supabase
    const { data: currentMilestone, error: milestoneError } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .eq('milestone_id', milestoneId)
      .single();

    if (milestoneError || !currentMilestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

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

      // Store inspection results using Supabase
      const { error: updateError } = await supabase
        .from('project_milestones')
        .update({
          inspection_notes: inspectionReport,
          inspection_status: inspectionReport.toLowerCase().includes('violation') ? 'failed' : 'passed'
        })
        .eq('project_id', projectId)
        .eq('milestone_id', milestoneId);

      if (updateError) {
        console.error('[Sentinel] Error updating milestone:', updateError);
      }

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

    // Get evidence record using Supabase
    const { data: evidence, error: evidenceError } = await supabase
      .from('project_evidence')
      .select('*')
      .eq('id', evidenceId)
      .single();

    if (evidenceError || !evidence) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    // Get milestone details for context using Supabase
    let milestoneRequirements = null;
    if (evidence.milestone_id) {
      const { data: milestone } = await supabase
        .from('project_milestones')
        .select('milestone_name')
        .eq('id', evidence.milestone_id)
        .single();

      if (milestone) {
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

    // STEP 3: Update evidence record using Supabase
    const { error: evidenceUpdateError } = await supabase
      .from('project_evidence')
      .update({
        forensic_analysis_status: 'passed',
        forensic_checks: {
          is_authentic: forensicData.is_authentic,
          confidence: forensicData.confidence,
          ai_generated_probability: forensicData.ai_generated_probability,
          screen_capture_detected: forensicData.screen_capture_detected,
          manipulation_detected: forensicData.manipulation_detected,
          fraud_indicators: forensicData.fraud_indicators,
          authenticity_indicators: forensicData.authenticity_indicators
        },
        quality_check_status: forensicData.recommendation === 'approved' ? 'approved' : 'rejected',
        quality_check_result: forensicData.quality_assessment,
        verification_result: verificationResult,
        rejection_reason: rejectionReason,
        processed_by_agent: 'sentinel',
        agent_processing_time_ms: processingTime,
        processed_at: new Date().toISOString(),
        approved_at: verificationResult === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', evidenceId);

    if (evidenceUpdateError) {
      console.error('[Sentinel] Error updating evidence:', evidenceUpdateError);
    }

    // STEP 4: Update milestone if approved using Supabase
    if (verificationResult === 'approved' && evidence.milestone_id) {
      // First get the current status
      const { data: currentMilestone } = await supabase
        .from('project_milestones')
        .select('status')
        .eq('id', evidence.milestone_id)
        .single();

      const newStatus = currentMilestone?.status === 'inspection_pending' ? 'inspection_passed' : currentMilestone?.status;

      const { error: milestoneUpdateError } = await supabase
        .from('project_milestones')
        .update({
          verification_status: 'approved',
          verification_approved_at: new Date().toISOString(),
          status: newStatus
        })
        .eq('id', evidence.milestone_id);

      if (milestoneUpdateError) {
        console.error('[Sentinel] Error updating milestone:', milestoneUpdateError);
      }

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

  /**
   * PHASE 4: GPS Location Verification
   * Calculate distance between two GPS coordinates using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula
    const R = 6371; // Earth's radius in kilometers

    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in kilometers

    return distance;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} Radians
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Verify contractor is physically on-site
   * Compares user's GPS coordinates to project site coordinates
   * @param {Object} projectCoords - { latitude, longitude } of project site
   * @param {Object} userCoords - { latitude, longitude } of user's current location
   * @param {number} maxDistanceKm - Maximum allowed distance in kilometers (default: 0.1km = 100m)
   * @returns {Object} Verification result with distance and verification status
   */
  static async verifyLocation(projectCoords, userCoords, maxDistanceKm = 0.1) {
    console.log('[Sentinel] Verifying GPS location...');

    try {
      // Validate inputs
      if (!projectCoords?.latitude || !projectCoords?.longitude) {
        throw new Error('Invalid project coordinates');
      }

      if (!userCoords?.latitude || !userCoords?.longitude) {
        throw new Error('Invalid user coordinates');
      }

      // Calculate distance using Haversine formula
      const distance = this.calculateDistance(
        projectCoords.latitude,
        projectCoords.longitude,
        userCoords.latitude,
        userCoords.longitude
      );

      // Convert to meters for reporting
      const distanceMeters = Math.round(distance * 1000);

      // Verify within threshold
      const verified = distance <= maxDistanceKm;

      console.log(
        `[Sentinel] Distance: ${distanceMeters}m, ` +
        `Threshold: ${maxDistanceKm * 1000}m, ` +
        `Verified: ${verified}`
      );

      return {
        success: true,
        verified: verified,
        distance_km: parseFloat(distance.toFixed(3)),
        distance_meters: distanceMeters,
        threshold_km: maxDistanceKm,
        threshold_meters: maxDistanceKm * 1000,
        project_coords: projectCoords,
        user_coords: userCoords,
        reason: verified
          ? 'Contractor is on-site'
          : `Contractor is ${distanceMeters}m away from job site (max: ${maxDistanceKm * 1000}m)`
      };

    } catch (error) {
      console.error('[Sentinel] GPS verification error:', error);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Verify location for a specific project by ID
   * Looks up project site coordinates from database
   * @param {string|number} projectId - Project ID
   * @param {Object} userCoords - { latitude, longitude } of user's current location
   * @returns {Object} Verification result
   */
  static async verifyLocationForProject(projectId, userCoords) {
    console.log(`[Sentinel] Verifying location for project ${projectId}...`);

    try {
      // Fetch project site coordinates using Supabase
      const { data: project, error: projectError } = await supabase
        .from('job_postings')
        .select('site_latitude, site_longitude, address')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new Error(`Project ${projectId} not found`);
      }

      if (!project.site_latitude || !project.site_longitude) {
        // Try to geocode the address if coordinates not set
        console.warn('[Sentinel] Project coordinates not set, attempting geocoding...');

        // TODO: Implement geocoding service (Google Maps, Mapbox, etc.)
        // For now, return error
        throw new Error('Project site coordinates not configured. Please set site_latitude and site_longitude.');
      }

      const projectCoords = {
        latitude: parseFloat(project.site_latitude),
        longitude: parseFloat(project.site_longitude)
      };

      // Verify location
      const result = await this.verifyLocation(projectCoords, userCoords);

      // Add project info to result
      result.project_id = projectId;
      result.project_address = project.address;

      return result;

    } catch (error) {
      console.error('[Sentinel] Project location verification error:', error);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze job site photos for trade identification, safety hazards, and quality issues
   * Part of Zero-App Protocol for field updates
   * @param {Array<string>} imageUrls - Array of image URLs to analyze
   * @returns {Promise<string>} - Concise text summary of analysis
   */
  static async analyzeJobSitePhotos(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      return '';
    }

    console.log(`[Sentinel] Analyzing ${imageUrls.length} job site photo(s) for field update...`);

    const systemPrompt = `You are a Construction Forensic Auditor with expertise across all trades. Analyze construction site photos and provide:

1. **Trade Identification**: What work is being shown? (Framing, Plumbing, Electrical, HVAC, Drywall, etc.)
2. **Safety Hazards**: Flag any OSHA violations, unsafe conditions, or hazards
3. **Quality Assessment**: Note visible defects, poor workmanship, or deviations from standard practice
4. **Site Conditions**: Comment on cleanliness, organization, and professionalism

Be concise and specific. Focus on actionable observations.`;

    try {
      // Prepare messages with all images
      const imageMessages = imageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      }));

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze these construction site photos:'
              },
              ...imageMessages
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.2
      });

      const analysis = response.choices[0].message.content;
      console.log(`[Sentinel] Analysis complete: ${analysis.substring(0, 100)}...`);

      return analysis;
    } catch (error) {
      console.error('[Sentinel] Photo analysis failed:', error);
      return `[Vision Analysis Failed: ${error.message}]`;
    }
  }
}

// ========================================
// 7. THE HAWK (Contractor Scout)
// Real-time contractor/supplier procurement
// ========================================
class HawkAgent {
  /**
   * Find contractors matching project requirements
   * @param {Object} projectData - { zipCode, trade, projectType, estimateRange }
   * @returns {Array} Contractors sorted by rating, distance, and availability
   */
  static async findContractors(projectData) {
    const { zipCode, trade, projectType, estimateRange } = projectData;

    console.log(`[Hawk] Scouting contractors for ${trade} near ${zipCode}...`);

    try {
      // Query user_profiles for contractors matching trade using Supabase
      const { data: contractorsList, error: contractorsError } = await supabase
        .from('user_profiles')
        .select('id, email, company_name, trade, phone, location_zip, license_verified')
        .eq('role', 'contractor')
        .eq('trade', trade)
        .eq('license_verified', true)
        .limit(20);

      if (contractorsError) {
        throw new Error(`Failed to fetch contractors: ${contractorsError.message}`);
      }

      const result = { rows: contractorsList || [] };

      // Calculate distances and format results
      let contractors = result.rows.map(contractor => {
        const distance = this.calculateZipDistance(zipCode, contractor.location_zip);

        return {
          id: contractor.id,
          email: contractor.email,
          company_name: contractor.company_name,
          trade: contractor.trade,
          phone: contractor.phone,
          location_zip: contractor.location_zip,
          license_verified: contractor.license_verified,
          rating: parseFloat(contractor.avg_rating).toFixed(1),
          review_count: parseInt(contractor.review_count),
          distance_miles: distance,
          estimated_response_time: distance < 10 ? '24 hours' : distance < 30 ? '48 hours' : '3-5 days',
          is_unclaimed: false, // Internal DB contractors are claimed
          source: 'internal_db'
        };
      });

      // Sort by distance (closest first)
      contractors.sort((a, b) => a.distance_miles - b.distance_miles);

      // Take top 10 closest with good ratings
      let topContractors = contractors
        .filter(c => c.rating >= 3.5 || c.review_count === 0) // Include new contractors
        .slice(0, 10);

      console.log(`[Hawk] Found ${topContractors.length} contractors from internal DB`);

      // ========================================
      // EXTERNAL FALLBACK: Search Web if < 3 Results
      // ========================================
      if (topContractors.length < 3) {
        console.log(`[Hawk] ⚠️ Insufficient contractors (${topContractors.length}/3), searching web...`);

        const ResearcherService = require('./ResearcherService');

        try {
          // Search web for contractors
          const webContractors = await ResearcherService.searchWeb(trade, zipCode);

          console.log(`[Hawk] Found ${webContractors.length} contractors from web search`);

          // Mark web contractors as "ghost profiles"
          const ghostProfiles = webContractors.map(contractor => ({
            ...contractor,
            source: 'web_search',
            is_unclaimed: true,
            estimated_response_time: 'Unknown - External'
          }));

          // Combine internal + web results
          topContractors = [...topContractors, ...ghostProfiles];

          console.log(`[Hawk] ✅ Combined results: ${topContractors.length} total contractors`);

        } catch (webError) {
          console.error('[Hawk] Web search fallback failed:', webError);
          // Continue with internal results only
        }
      } else {
        console.log(`[Hawk] ✅ Found ${topContractors.length} qualified contractors from internal DB`);
      }

      // Log agent activity
      await logAgentActivity(
        null, // No project ID yet for initial scouting
        'hawk',
        'find_contractors',
        `Scouted ${topContractors.length} ${trade} contractors near ${zipCode} (${topContractors.filter(c => !c.is_unclaimed).length} internal, ${topContractors.filter(c => c.is_unclaimed).length} external)`,
        { trade, zipCode, projectType },
        { contractors: topContractors.map(c => ({ company: c.company_name, rating: c.rating, distance: c.distance_miles, source: c.source })) },
        'completed'
      );

      return topContractors;

    } catch (error) {
      console.error('[Hawk] Error finding contractors:', error);
      throw new Error(`Failed to find contractors: ${error.message}`);
    }
  }

  /**
   * Find suppliers for materials
   * @param {string} zipCode - Project ZIP code
   * @param {string} trade - Trade type (for material specialization)
   * @returns {Array} Suppliers sorted by proximity
   */
  static async findSuppliers(zipCode, trade) {
    console.log(`[Hawk] Finding suppliers for ${trade} near ${zipCode}...`);

    try {
      // Query suppliers table (if exists) or user_profiles with role='supplier' using Supabase
      const { data: suppliersList, error: suppliersError } = await supabase
        .from('user_profiles')
        .select('id, email, company_name, phone, location_zip, trade')
        .eq('role', 'supplier')
        .or(`trade.eq.${trade},trade.eq.general`)
        .order('company_name', { ascending: true })
        .limit(10);

      if (suppliersError) {
        console.error('[Hawk] Error fetching suppliers:', suppliersError);
        return [];
      }

      const result = { rows: suppliersList || [] };

      const suppliers = result.rows.map(supplier => {
        const distance = this.calculateZipDistance(zipCode, supplier.location_zip);

        return {
          id: supplier.id,
          company_name: supplier.company_name,
          email: supplier.email,
          phone: supplier.phone,
          location_zip: supplier.location_zip,
          specialty: supplier.specialty,
          distance_miles: distance,
          delivery_estimate: distance < 25 ? 'Same/Next Day' : distance < 50 ? '2-3 Days' : '1 Week'
        };
      });

      // Sort by distance
      suppliers.sort((a, b) => a.distance_miles - b.distance_miles);

      console.log(`[Hawk] ✅ Found ${suppliers.length} suppliers`);

      return suppliers;

    } catch (error) {
      console.error('[Hawk] Error finding suppliers:', error);
      // Return empty array if suppliers table doesn't exist yet
      return [];
    }
  }

  /**
   * Calculate approximate distance between ZIP codes
   * Uses simplified lat/long estimation (accurate within ~10%)
   * @param {string} zip1 - First ZIP code
   * @param {string} zip2 - Second ZIP code
   * @returns {number} Approximate distance in miles
   */
  static calculateZipDistance(zip1, zip2) {
    if (!zip1 || !zip2) return 999;
    if (zip1 === zip2) return 0;

    // Simplified ZIP code distance estimation
    // First 3 digits of ZIP represent sectional center
    const zip1Prefix = parseInt(zip1.substring(0, 3));
    const zip2Prefix = parseInt(zip2.substring(0, 3));

    // Rough estimation: Each ZIP prefix difference ≈ 50-100 miles
    const prefixDiff = Math.abs(zip1Prefix - zip2Prefix);

    if (prefixDiff === 0) {
      // Same sectional center - check last 2 digits
      const zip1Suffix = parseInt(zip1.substring(3, 5));
      const zip2Suffix = parseInt(zip2.substring(3, 5));
      const suffixDiff = Math.abs(zip1Suffix - zip2Suffix);
      return Math.round(suffixDiff * 2); // ~2 miles per suffix difference
    } else {
      // Different sectional centers
      return Math.round(prefixDiff * 75); // ~75 miles per prefix difference
    }
  }

  /**
   * Match contractors to project automatically
   * Used by OrchestratorAgent to pre-populate contractor pool
   * @param {number} projectId - Project ID
   * @returns {Object} Matched contractors and suppliers
   */
  static async autoMatchContractors(projectId) {
    console.log(`[Hawk] Auto-matching contractors for project ${projectId}...`);

    try {
      // Get project details using Supabase
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Get milestones to determine required trades using Supabase
      const { data: milestones, error: milestonesError } = await supabase
        .from('project_milestones')
        .select('assigned_contractor_role')
        .eq('project_id', projectId);

      if (milestonesError) {
        throw new Error(`Failed to fetch milestones: ${milestonesError.message}`);
      }

      const requiredTrades = [...new Set(milestones
        .map(m => m.assigned_contractor_role)
        .filter(Boolean))];

      // Find contractors for each trade
      const contractorMatches = {};

      for (const trade of requiredTrades) {
        const contractors = await this.findContractors({
          zipCode: project.location_zip,
          trade: trade,
          projectType: project.project_type,
          estimateRange: project.estimated_budget
        });

        contractorMatches[trade] = contractors;
      }

      // Find suppliers
      const suppliers = await this.findSuppliers(
        project.location_zip,
        project.project_type
      );

      console.log(`[Hawk] ✅ Auto-matched contractors for ${requiredTrades.length} trades`);

      return {
        success: true,
        contractors_by_trade: contractorMatches,
        suppliers: suppliers,
        total_contractors: Object.values(contractorMatches).flat().length,
        total_suppliers: suppliers.length
      };

    } catch (error) {
      console.error('[Hawk] Error auto-matching contractors:', error);
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
  DiplomatAgent,
  SentinelAgent,
  HawkAgent,

  // Helper functions
  getProjectTemplate,
  getProjectMilestones,
  logAgentActivity
};
