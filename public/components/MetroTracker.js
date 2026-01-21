/**
 * MetroTracker.js - Horizontal Project Milestone Tracker
 * Visual style: Domino's Pizza Tracker / Google Maps Trip Progress
 * Industrial SaaS aesthetic (Procore/Linear style)
 */

class MetroTracker {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.milestones = options.milestones || [];
    this.currentPhase = options.currentPhase || 'planning';
    this.changeOrders = options.changeOrders || [];
    this.delays = options.delays || [];

    if (!this.container) {
      console.error(`MetroTracker: Container with id "${containerId}" not found`);
      return;
    }

    this.render();
  }

  /**
   * Get the status of a milestone (completed, current, future)
   */
  getMilestoneStatus(milestone) {
    const phaseOrder = ['planning', 'demo', 'rough_in', 'inspection', 'finish', 'punchlist', 'complete'];
    const currentIndex = phaseOrder.indexOf(this.currentPhase);
    const milestoneIndex = phaseOrder.indexOf(milestone.phase);

    if (milestoneIndex < currentIndex) return 'completed';
    if (milestoneIndex === currentIndex) return 'current';
    return 'future';
  }

  /**
   * Check if a milestone has a change order or delay
   */
  getBranches(milestone) {
    const branches = [];

    // Find change orders for this milestone
    const relatedChangeOrders = this.changeOrders.filter(
      co => co.milestoneId === milestone.id || co.phase === milestone.phase
    );

    // Find delays for this milestone
    const relatedDelays = this.delays.filter(
      delay => delay.milestoneId === milestone.id || delay.phase === milestone.phase
    );

    return [...relatedChangeOrders, ...relatedDelays];
  }

  /**
   * Render the tracker
   */
  render() {
    if (!this.container) return;

    // Create the tracker HTML
    this.container.innerHTML = `
      <div class="metro-tracker-container">
        <div class="metro-tracker-line">
          ${this.milestones.map((milestone, index) => this.renderMilestone(milestone, index)).join('')}
        </div>
      </div>
    `;

    // Add event listeners for hover tooltips
    this.attachEventListeners();
  }

  /**
   * Render a single milestone node
   */
  renderMilestone(milestone, index) {
    const status = this.getMilestoneStatus(milestone);
    const branches = this.getBranches(milestone);
    const hasBranches = branches.length > 0;

    return `
      <div class="metro-milestone-wrapper" data-milestone-id="${milestone.id}">
        <div class="metro-milestone ${status} ${hasBranches ? 'has-branches' : ''}"
             data-status="${status}"
             data-tooltip="${milestone.agentSummary || milestone.title}">
          <div class="metro-node">
            ${this.renderNodeIcon(status)}
          </div>
          ${index < this.milestones.length - 1 ? '<div class="metro-connector"></div>' : ''}
        </div>
        <div class="metro-label">${milestone.title}</div>
        ${hasBranches ? this.renderBranches(branches) : ''}
      </div>
    `;
  }

  /**
   * Render the icon inside the node
   */
  renderNodeIcon(status) {
    switch (status) {
      case 'completed':
        return '<i class="fas fa-check"></i>';
      case 'current':
        return '<div class="pulse-ring"></div>';
      case 'future':
      default:
        return '';
    }
  }

  /**
   * Render branches (Change Orders / Delays)
   */
  renderBranches(branches) {
    return `
      <div class="metro-branches">
        <div class="metro-branch-line"></div>
        ${branches.map(branch => `
          <div class="metro-branch-node ${branch.type || 'change-order'}"
               data-tooltip="${branch.description || branch.title}">
            <i class="fas fa-exclamation-triangle"></i>
            <span class="metro-branch-label">${branch.title}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Attach event listeners for tooltips
   */
  attachEventListeners() {
    const nodes = this.container.querySelectorAll('[data-tooltip]');

    nodes.forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target, e.target.dataset.tooltip);
      });

      node.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  /**
   * Show tooltip on hover
   */
  showTooltip(element, text) {
    // Remove any existing tooltip
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'metro-tooltip';
    tooltip.textContent = text;
    tooltip.id = 'metro-tooltip';

    document.body.appendChild(tooltip);

    // Position the tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';

    // Fade in
    setTimeout(() => tooltip.classList.add('visible'), 10);
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = document.getElementById('metro-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Update the tracker with new data
   */
  update(options) {
    if (options.milestones) this.milestones = options.milestones;
    if (options.currentPhase) this.currentPhase = options.currentPhase;
    if (options.changeOrders) this.changeOrders = options.changeOrders;
    if (options.delays) this.delays = options.delays;

    this.render();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetroTracker;
}
