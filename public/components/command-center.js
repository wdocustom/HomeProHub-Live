/**
 * command-center.js - Dual-Lens Project Dashboard
 * Adapts view based on user role:
 * - Homeowners: SmartTracker (Visual Journey)
 * - Contractors: ProjectTimeline (Tactical Gantt)
 *
 * Industrial SaaS quality (reference: Linear, Procore)
 */

class CommandCenter {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.projectId = options.projectId || null;
    this.authService = options.authService || window.AuthService;
    this.onReady = options.onReady || null;

    if (!this.container) {
      console.error(`CommandCenter: Container with id "${containerId}" not found`);
      return;
    }

    if (!this.authService) {
      console.error('CommandCenter: AuthService not found. Please initialize AuthService first.');
      return;
    }

    this.userRole = null;
    this.currentView = null;
    this.projectData = null;

    this.init();
  }

  /**
   * Initialize the Command Center
   */
  async init() {
    try {
      // Show loading state
      this.showLoading();

      // Fetch user role
      this.userRole = await this.fetchUserRole();

      if (!this.userRole) {
        this.showError('Unable to determine user role. Please sign in.');
        return;
      }

      // Fetch project data
      this.projectData = await this.fetchProjectData();

      if (!this.projectData) {
        this.showError('Unable to load project data.');
        return;
      }

      // Render appropriate view based on role
      this.renderRoleBasedView();

      // Call onReady callback
      if (this.onReady) {
        this.onReady(this.userRole, this.currentView);
      }

    } catch (error) {
      console.error('CommandCenter initialization error:', error);
      this.showError('Failed to initialize dashboard. Please try again.');
    }
  }

  /**
   * Fetch user role from AuthService
   */
  async fetchUserRole() {
    try {
      // Check if AuthService is available
      if (!this.authService || !this.authService.getUserRole) {
        console.error('AuthService.getUserRole() not available');
        return null;
      }

      const role = await this.authService.getUserRole();

      if (!role) {
        console.warn('User role not found, defaulting to homeowner');
        return 'homeowner';
      }

      return role;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return 'homeowner'; // Default to homeowner on error
    }
  }

  /**
   * Fetch project data from API
   */
  async fetchProjectData() {
    try {
      if (!this.projectId) {
        console.warn('No project ID provided, using sample data');
        return this.getSampleData();
      }

      // Fetch project state
      const stateResponse = await fetch(`/api/agents/project-state/${this.projectId}`);
      if (!stateResponse.ok) {
        console.warn('Failed to fetch project state, using sample data');
        return this.getSampleData();
      }

      const stateData = await stateResponse.json();

      // Fetch activity log
      const activityResponse = await fetch(`/api/agents/activity-log/${this.projectId}`);
      const activityData = activityResponse.ok ? await activityResponse.json() : { logs: [] };

      return {
        currentPhase: stateData.current_phase || 'planning',
        milestones: this.getMilestones(stateData),
        changeOrders: stateData.change_orders || [],
        tasks: this.getTasks(stateData),
        dependencies: stateData.dependencies || [],
        startDate: stateData.start_date || new Date().toISOString(),
        endDate: stateData.end_date || null,
        activityLog: activityData.logs || []
      };
    } catch (error) {
      console.error('Error fetching project data:', error);
      return this.getSampleData();
    }
  }

  /**
   * Get milestones from project state
   */
  getMilestones(stateData) {
    return [
      {
        id: 1,
        phase: 'planning',
        title: 'Planning',
        agentSummary: stateData.planning_summary || 'Project planning and initial setup'
      },
      {
        id: 2,
        phase: 'demo',
        title: 'Demo',
        agentSummary: stateData.demo_summary || 'Demolition and preparation'
      },
      {
        id: 3,
        phase: 'rough_in',
        title: 'Rough-In',
        agentSummary: stateData.rough_in_summary || 'Rough-in work: electrical, plumbing, HVAC'
      },
      {
        id: 4,
        phase: 'inspection',
        title: 'Inspection',
        agentSummary: stateData.inspection_summary || 'Inspections and compliance'
      },
      {
        id: 5,
        phase: 'finish',
        title: 'Finish',
        agentSummary: stateData.finish_summary || 'Finishing work and installation'
      },
      {
        id: 6,
        phase: 'punchlist',
        title: 'Punchlist',
        agentSummary: stateData.punchlist_summary || 'Final adjustments and fixes'
      },
      {
        id: 7,
        phase: 'complete',
        title: 'Complete',
        agentSummary: stateData.complete_summary || 'Project completed'
      }
    ];
  }

  /**
   * Get tasks for Gantt chart from milestones
   */
  getTasks(stateData) {
    const startDate = new Date(stateData.start_date || new Date());
    const tasks = [];

    const milestones = [
      { title: 'Planning', duration: 7, is_critical: true },
      { title: 'Demo', duration: 3, is_critical: false },
      { title: 'Rough-In', duration: 14, is_critical: true },
      { title: 'Inspection', duration: 2, is_critical: true },
      { title: 'Finish', duration: 10, is_critical: false },
      { title: 'Punchlist', duration: 5, is_critical: false },
      { title: 'Complete', duration: 1, is_critical: true }
    ];

    let currentDate = new Date(startDate);

    milestones.forEach((milestone, index) => {
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + milestone.duration);

      tasks.push({
        id: `task-${index + 1}`,
        title: milestone.title,
        startDate: new Date(currentDate).toISOString(),
        endDate: endDate.toISOString(),
        is_critical: milestone.is_critical
      });

      currentDate = new Date(endDate);
    });

    return tasks;
  }

  /**
   * Get sample data for demo/fallback
   */
  getSampleData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 14); // Started 2 weeks ago

    return {
      currentPhase: 'rough_in',
      milestones: [
        { id: 1, phase: 'planning', title: 'Planning', agentSummary: 'Project planning completed' },
        { id: 2, phase: 'demo', title: 'Demo', agentSummary: 'Demolition completed successfully' },
        { id: 3, phase: 'rough_in', title: 'Rough-In', agentSummary: 'Currently working on electrical and plumbing' },
        { id: 4, phase: 'inspection', title: 'Inspection', agentSummary: 'Scheduled for next week' },
        { id: 5, phase: 'finish', title: 'Finish', agentSummary: 'Waiting to start' },
        { id: 6, phase: 'punchlist', title: 'Punchlist', agentSummary: 'Not started' },
        { id: 7, phase: 'complete', title: 'Complete', agentSummary: 'Not started' }
      ],
      changeOrders: [
        {
          id: 'co-1',
          milestoneId: 3,
          phase: 'rough_in',
          title: 'Added Outlets',
          description: 'Added 3 additional outlets per homeowner request'
        }
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Planning',
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: true
        },
        {
          id: 'task-2',
          title: 'Demo',
          startDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: false
        },
        {
          id: 'task-3',
          title: 'Rough-In',
          startDate: new Date(startDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 24 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: true
        },
        {
          id: 'task-4',
          title: 'Inspection',
          startDate: new Date(startDate.getTime() + 24 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 26 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: true
        },
        {
          id: 'task-5',
          title: 'Finish',
          startDate: new Date(startDate.getTime() + 26 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 36 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: false
        },
        {
          id: 'task-6',
          title: 'Punchlist',
          startDate: new Date(startDate.getTime() + 36 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 41 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: false
        },
        {
          id: 'task-7',
          title: 'Complete',
          startDate: new Date(startDate.getTime() + 41 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(startDate.getTime() + 42 * 24 * 60 * 60 * 1000).toISOString(),
          is_critical: true
        }
      ],
      dependencies: [
        { from: 'task-1', to: 'task-2' },
        { from: 'task-2', to: 'task-3' },
        { from: 'task-3', to: 'task-4' },
        { from: 'task-4', to: 'task-5' },
        { from: 'task-5', to: 'task-6' },
        { from: 'task-6', to: 'task-7' }
      ],
      startDate: startDate.toISOString(),
      endDate: null,
      activityLog: []
    };
  }

  /**
   * Render view based on user role
   */
  renderRoleBasedView() {
    // Clear container
    this.container.innerHTML = '';

    if (this.userRole === 'homeowner') {
      this.renderHomeownerView();
    } else if (this.userRole === 'contractor') {
      this.renderContractorView();
    } else {
      this.showError('Invalid user role');
    }
  }

  /**
   * Render SmartTracker for homeowners
   */
  renderHomeownerView() {
    // Create container
    const viewContainer = document.createElement('div');
    viewContainer.id = 'smart-tracker-view';
    viewContainer.className = 'command-center-view';
    viewContainer.innerHTML = `
      <div class="view-header">
        <h2 class="view-title">Your Project Journey</h2>
        <p class="view-subtitle">Track your home improvement progress</p>
      </div>
      <div id="smart-tracker-container"></div>
    `;

    this.container.appendChild(viewContainer);

    // Initialize SmartTracker
    if (typeof SmartTracker !== 'undefined') {
      this.currentView = new SmartTracker('smart-tracker-container', {
        milestones: this.projectData.milestones,
        currentPhase: this.projectData.currentPhase,
        changeOrders: this.projectData.changeOrders
      });
    } else {
      console.error('SmartTracker class not found. Make sure SmartTracker.js is loaded.');
    }
  }

  /**
   * Render ProjectTimeline for contractors
   */
  renderContractorView() {
    // Create container
    const viewContainer = document.createElement('div');
    viewContainer.id = 'project-timeline-view';
    viewContainer.className = 'command-center-view';
    viewContainer.innerHTML = `
      <div class="view-header">
        <h2 class="view-title">Project Timeline</h2>
        <p class="view-subtitle">Tactical Gantt chart for project management</p>
      </div>
      <div id="project-timeline-container"></div>
    `;

    this.container.appendChild(viewContainer);

    // Initialize ProjectTimeline
    if (typeof ProjectTimeline !== 'undefined') {
      this.currentView = new ProjectTimeline('project-timeline-container', {
        tasks: this.projectData.tasks,
        startDate: this.projectData.startDate,
        endDate: this.projectData.endDate,
        dependencies: this.projectData.dependencies,
        onTaskClick: (task) => this.handleTaskClick(task)
      });

      // Scroll to today after render
      setTimeout(() => {
        this.currentView.scrollToToday();
      }, 500);
    } else {
      console.error('ProjectTimeline class not found. Make sure ProjectTimeline.js is loaded.');
    }
  }

  /**
   * Handle task click (for contractor view)
   */
  handleTaskClick(task) {
    console.log('Task clicked:', task);

    // Dispatch event for slide-over panel
    const event = new CustomEvent('command-center-task-clicked', {
      detail: { task }
    });
    document.dispatchEvent(event);

    // You can implement a slide-over panel here
    // For now, just log it
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.container.innerHTML = `
      <div class="command-center-loading">
        <div class="loading-spinner"></div>
        <p>Loading your project dashboard...</p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  showError(message) {
    this.container.innerHTML = `
      <div class="command-center-error">
        <div class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Refresh/update the view
   */
  async refresh() {
    this.projectData = await this.fetchProjectData();

    if (this.currentView && this.currentView.update) {
      if (this.userRole === 'homeowner') {
        this.currentView.update({
          milestones: this.projectData.milestones,
          currentPhase: this.projectData.currentPhase,
          changeOrders: this.projectData.changeOrders
        });
      } else {
        this.currentView.update({
          tasks: this.projectData.tasks,
          startDate: this.projectData.startDate,
          endDate: this.projectData.endDate,
          dependencies: this.projectData.dependencies
        });
      }
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommandCenter;
}
