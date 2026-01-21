/**
 * ProjectTimeline.js - Contractor Tactical Gantt Chart
 * High-density logistics view for contractors to manage timelines
 * Target: Contractors who need detailed scheduling control
 */

class ProjectTimeline {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.tasks = options.tasks || [];
    this.startDate = options.startDate ? new Date(options.startDate) : new Date();
    this.endDate = options.endDate ? new Date(options.endDate) : this.calculateEndDate();
    this.dependencies = options.dependencies || [];
    this.onTaskClick = options.onTaskClick || this.defaultTaskClickHandler;

    if (!this.container) {
      console.error(`ProjectTimeline: Container with id "${containerId}" not found`);
      return;
    }

    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);

    this.render();
  }

  /**
   * Calculate end date based on tasks
   */
  calculateEndDate() {
    if (this.tasks.length === 0) {
      const end = new Date();
      end.setDate(end.getDate() + 90); // Default 90 days
      return end;
    }

    const latestDate = this.tasks.reduce((latest, task) => {
      const taskEnd = new Date(task.endDate);
      return taskEnd > latest ? taskEnd : latest;
    }, new Date(this.startDate));

    // Add buffer
    latestDate.setDate(latestDate.getDate() + 7);
    return latestDate;
  }

  /**
   * Generate array of dates between start and end
   */
  getDateRange() {
    const dates = [];
    const current = new Date(this.startDate);

    while (current <= this.endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Check if date is weekend
   */
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Check if date is today
   */
  isToday(date) {
    return date.toDateString() === this.today.toDateString();
  }

  /**
   * Calculate task bar position and width
   */
  getTaskBarMetrics(task) {
    const dates = this.getDateRange();
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);

    taskStart.setHours(0, 0, 0, 0);
    taskEnd.setHours(0, 0, 0, 0);

    const startIndex = dates.findIndex(d => d.toDateString() === taskStart.toDateString());
    const endIndex = dates.findIndex(d => d.toDateString() === taskEnd.toDateString());

    if (startIndex === -1 || endIndex === -1) {
      return null;
    }

    const dayWidth = 100 / dates.length;
    const left = startIndex * dayWidth;
    const width = (endIndex - startIndex + 1) * dayWidth;

    return { left: `${left}%`, width: `${width}%` };
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  /**
   * Render the timeline
   */
  render() {
    if (!this.container) return;

    const dates = this.getDateRange();

    this.container.innerHTML = `
      <div class="project-timeline-container">
        <!-- Timeline Header -->
        <div class="timeline-header">
          <div class="timeline-header-left">
            <h3>Milestone</h3>
          </div>
          <div class="timeline-header-right">
            <div class="timeline-calendar-header">
              ${dates.map(date => `
                <div class="timeline-date-cell ${this.isWeekend(date) ? 'weekend' : ''} ${this.isToday(date) ? 'today' : ''}">
                  <div class="date-label">${this.formatDate(date)}</div>
                  <div class="day-label">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][date.getDay()]}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Timeline Grid -->
        <div class="timeline-grid">
          <!-- Left pane: Task names -->
          <div class="timeline-grid-left">
            ${this.tasks.map(task => `
              <div class="timeline-task-name">
                <span class="task-name-text">${task.title}</span>
                ${task.is_critical ? '<span class="critical-badge">Critical</span>' : ''}
              </div>
            `).join('')}
          </div>

          <!-- Right pane: Calendar grid with bars -->
          <div class="timeline-grid-right">
            <!-- Background grid -->
            <div class="timeline-calendar-grid">
              ${dates.map(date => `
                <div class="timeline-grid-column ${this.isWeekend(date) ? 'weekend' : ''}"></div>
              `).join('')}
            </div>

            <!-- Today indicator -->
            ${this.renderTodayIndicator(dates)}

            <!-- Task bars -->
            <div class="timeline-bars-container">
              ${this.tasks.map((task, index) => this.renderTaskBar(task, index)).join('')}
            </div>

            <!-- Dependencies (SVG overlay) -->
            ${this.renderDependencies()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render today indicator (red vertical line)
   */
  renderTodayIndicator(dates) {
    const todayIndex = dates.findIndex(d => this.isToday(d));
    if (todayIndex === -1) return '';

    const dayWidth = 100 / dates.length;
    const position = (todayIndex + 0.5) * dayWidth; // Center of the day

    return `
      <div class="timeline-today-indicator" style="left: ${position}%;">
        <div class="today-line"></div>
        <div class="today-label">Today</div>
      </div>
    `;
  }

  /**
   * Render a single task bar
   */
  renderTaskBar(task, index) {
    const metrics = this.getTaskBarMetrics(task);
    if (!metrics) return '';

    const rowHeight = 56; // Height of each row
    const barTop = index * rowHeight + 14; // 14px padding

    return `
      <div class="timeline-task-bar ${task.is_critical ? 'critical' : ''}"
           data-task-id="${task.id}"
           data-task-index="${index}"
           style="left: ${metrics.left}; width: ${metrics.width}; top: ${barTop}px;">
        <div class="task-bar-label">${task.title}</div>
      </div>
    `;
  }

  /**
   * Render dependency arrows (SVG)
   */
  renderDependencies() {
    if (this.dependencies.length === 0) return '';

    const svgHeight = this.tasks.length * 56; // 56px per row

    return `
      <svg class="timeline-dependencies-svg"
           style="position: absolute; top: 0; left: 0; width: 100%; height: ${svgHeight}px; pointer-events: none; z-index: 5;">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#cbd5e1" />
          </marker>
        </defs>
        ${this.dependencies.map(dep => this.renderDependencyArrow(dep)).join('')}
      </svg>
    `;
  }

  /**
   * Render a single dependency arrow
   */
  renderDependencyArrow(dependency) {
    const fromTask = this.tasks.find(t => t.id === dependency.from);
    const toTask = this.tasks.find(t => t.id === dependency.to);

    if (!fromTask || !toTask) return '';

    const fromMetrics = this.getTaskBarMetrics(fromTask);
    const toMetrics = this.getTaskBarMetrics(toTask);

    if (!fromMetrics || !toMetrics) return '';

    const rowHeight = 56;
    const fromIndex = this.tasks.indexOf(fromTask);
    const toIndex = this.tasks.indexOf(toTask);

    // Calculate positions
    const fromX = parseFloat(fromMetrics.left) + parseFloat(fromMetrics.width);
    const fromY = fromIndex * rowHeight + 28; // Center of bar

    const toX = parseFloat(toMetrics.left);
    const toY = toIndex * rowHeight + 28;

    // Create Bezier curve path
    const controlPointX = (fromX + toX) / 2;
    const path = `M ${fromX} ${fromY} C ${controlPointX} ${fromY}, ${controlPointX} ${toY}, ${toX} ${toY}`;

    return `
      <path class="dependency-arrow"
            d="${path}"
            fill="none"
            stroke="#cbd5e1"
            stroke-width="2"
            marker-end="url(#arrowhead)" />
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const taskBars = this.container.querySelectorAll('.timeline-task-bar');

    taskBars.forEach(bar => {
      bar.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          this.onTaskClick(task);
        }
      });

      // Hover effect
      bar.addEventListener('mouseenter', (e) => {
        e.currentTarget.classList.add('hover');
      });

      bar.addEventListener('mouseleave', (e) => {
        e.currentTarget.classList.remove('hover');
      });
    });
  }

  /**
   * Default task click handler
   */
  defaultTaskClickHandler(task) {
    console.log('Task clicked:', task);
    // Dispatch custom event for slide-over panel
    const event = new CustomEvent('task-clicked', {
      detail: { task }
    });
    document.dispatchEvent(event);
  }

  /**
   * Update the timeline with new data
   */
  update(options) {
    if (options.tasks) this.tasks = options.tasks;
    if (options.startDate) this.startDate = new Date(options.startDate);
    if (options.endDate) this.endDate = new Date(options.endDate);
    if (options.dependencies) this.dependencies = options.dependencies;

    this.render();
  }

  /**
   * Scroll to today
   */
  scrollToToday() {
    const todayIndicator = this.container.querySelector('.timeline-today-indicator');
    if (todayIndicator) {
      const rightPane = this.container.querySelector('.timeline-grid-right');
      const indicatorLeft = parseFloat(todayIndicator.style.left);
      const containerWidth = rightPane.offsetWidth;

      rightPane.scrollLeft = (indicatorLeft / 100) * rightPane.scrollWidth - containerWidth / 2;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectTimeline;
}
