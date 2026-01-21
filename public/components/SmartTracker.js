/**
 * SmartTracker.js - Homeowner Visual Journey Map
 * Style: Instacart/Domino's Tracker - Clean, linear, reassuring
 * Target: Homeowners who want visual progress updates
 */

class SmartTracker {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.milestones = options.milestones || [];
    this.currentPhase = options.currentPhase || 'planning';
    this.changeOrders = options.changeOrders || [];
    this.animationDuration = options.animationDuration || 1.5;

    if (!this.container) {
      console.error(`SmartTracker: Container with id "${containerId}" not found`);
      return;
    }

    this.render();
    this.animateProgressLine();
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
   * Calculate progress percentage for animation
   */
  getProgressPercentage() {
    const phaseOrder = ['planning', 'demo', 'rough_in', 'inspection', 'finish', 'punchlist', 'complete'];
    const currentIndex = phaseOrder.indexOf(this.currentPhase);

    if (currentIndex === -1) return 0;
    if (currentIndex === phaseOrder.length - 1) return 100;

    // Progress is to the middle of the current milestone
    return ((currentIndex + 0.5) / (phaseOrder.length - 1)) * 100;
  }

  /**
   * Check if a milestone has change orders (modifications)
   */
  getChangeOrders(milestone) {
    return this.changeOrders.filter(
      co => co.milestoneId === milestone.id || co.phase === milestone.phase
    );
  }

  /**
   * Render the tracker
   */
  render() {
    if (!this.container) return;

    // Create the tracker HTML
    this.container.innerHTML = `
      <div class="smart-tracker-container">
        <div class="smart-tracker-line">
          ${this.renderProgressTrack()}
          ${this.milestones.map((milestone, index) => this.renderMilestone(milestone, index)).join('')}
        </div>
      </div>
    `;

    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Render the progress track (the line connecting nodes)
   */
  renderProgressTrack() {
    return `
      <svg class="smart-tracker-svg"
           width="100%"
           height="100%"
           style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
        <!-- Base track (gray) -->
        <line class="smart-track-base"
              x1="5%"
              y1="16"
              x2="95%"
              y2="16"
              stroke="#e2e8f0"
              stroke-width="4"
              stroke-linecap="round"/>

        <!-- Progress track (green) - will be animated -->
        <line class="smart-track-progress"
              x1="5%"
              y1="16"
              x2="5%"
              y2="16"
              stroke="#059669"
              stroke-width="4"
              stroke-linecap="round"
              style="transition: x2 ${this.animationDuration}s ease-out;"/>
      </svg>
    `;
  }

  /**
   * Render a single milestone node
   */
  renderMilestone(milestone, index) {
    const status = this.getMilestoneStatus(milestone);
    const changeOrders = this.getChangeOrders(milestone);
    const hasChangeOrders = changeOrders.length > 0;
    const position = (index / (this.milestones.length - 1)) * 90 + 5; // 5% to 95%

    return `
      <div class="smart-milestone-wrapper"
           data-milestone-id="${milestone.id}"
           style="left: ${position}%;">
        <div class="smart-milestone ${status}" data-status="${status}">
          <div class="smart-node">
            ${this.renderNodeIcon(status)}
            ${status === 'current' ? '<div class="smart-pulse-ring"></div>' : ''}
          </div>
        </div>
        <div class="smart-label">${milestone.title}</div>
        ${hasChangeOrders ? this.renderChangeOrderBranch(changeOrders, position) : ''}
      </div>
    `;
  }

  /**
   * Render the icon inside the node
   */
  renderNodeIcon(status) {
    switch (status) {
      case 'completed':
        return '<i class="fas fa-check" style="color: white;"></i>';
      case 'current':
        return '<i class="fas fa-circle" style="color: #2563eb; font-size: 8px;"></i>';
      case 'future':
      default:
        return '';
    }
  }

  /**
   * Render change order branch with Bezier curve
   */
  renderChangeOrderBranch(changeOrders, nodePosition) {
    const branchY = 70; // 24px down from node + 46px node position
    const nodeX = nodePosition;

    return `
      <svg class="smart-branch-svg"
           style="position: absolute; top: 0; left: 0; width: 100%; height: 120px; pointer-events: none; z-index: 0;">
        <!-- Bezier curve from node to change order -->
        <path class="smart-branch-curve"
              d="M ${nodeX}% 32 Q ${nodeX}% ${branchY - 10}, ${nodeX}% ${branchY}"
              fill="none"
              stroke="#f97316"
              stroke-width="3"
              stroke-linecap="round"/>
      </svg>
      <div class="smart-change-orders" style="left: ${nodeX}%; top: ${branchY}px;">
        ${changeOrders.map(co => `
          <div class="smart-change-order-node"
               data-tooltip="${co.description || co.title}">
            <i class="fas fa-edit"></i>
            <span class="smart-co-label">${co.title}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Animate the progress line from left to right
   */
  animateProgressLine() {
    const progressLine = this.container.querySelector('.smart-track-progress');
    if (!progressLine) return;

    const progressPercent = this.getProgressPercentage();

    // Calculate x2 position (5% + progress)
    const x2Position = 5 + (progressPercent * 0.9); // 90% range from 5% to 95%

    setTimeout(() => {
      progressLine.setAttribute('x2', `${x2Position}%`);
    }, 100);
  }

  /**
   * Attach event listeners for tooltips and interactions
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

    // Click handlers for milestone nodes
    const milestoneNodes = this.container.querySelectorAll('.smart-milestone');
    milestoneNodes.forEach(node => {
      node.addEventListener('click', (e) => {
        const wrapper = e.currentTarget.closest('.smart-milestone-wrapper');
        const milestoneId = wrapper.dataset.milestoneId;
        this.onMilestoneClick(milestoneId);
      });
    });
  }

  /**
   * Show tooltip on hover
   */
  showTooltip(element, text) {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'smart-tooltip';
    tooltip.textContent = text;
    tooltip.id = 'smart-tooltip';

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    tooltip.style.transform = 'translateX(-50%)';

    setTimeout(() => tooltip.classList.add('visible'), 10);
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = document.getElementById('smart-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Handle milestone click (can be overridden)
   */
  onMilestoneClick(milestoneId) {
    // Dispatch custom event for parent to handle
    const event = new CustomEvent('milestone-clicked', {
      detail: { milestoneId }
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Update the tracker with new data
   */
  update(options) {
    if (options.milestones) this.milestones = options.milestones;
    if (options.currentPhase) this.currentPhase = options.currentPhase;
    if (options.changeOrders) this.changeOrders = options.changeOrders;

    this.render();
    this.animateProgressLine();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartTracker;
}
