/**
 * Grade Badge Component
 * Displays contractor grade with color coding and tooltip
 */

(function() {
  'use strict';

  // Grade color mapping
  const GRADE_COLORS = {
    'A+': '#10b981',
    'A': '#10b981',
    'A-': '#10b981',
    'B+': '#3b82f6',
    'B': '#3b82f6',
    'B-': '#3b82f6',
    'C+': '#f59e0b',
    'C': '#f59e0b',
    'C-': '#f59e0b',
    'D': '#f97316',
    'F': '#ef4444',
    'N/A': '#6b7280'
  };

  // Grade descriptions
  const GRADE_DESCRIPTIONS = {
    'A+': 'Excellent - Fully verified license, complete profile, great reviews',
    'A': 'Excellent - Verified license and strong profile',
    'A-': 'Very Good - Verified license, good profile completion',
    'B+': 'Good - Verified license, decent profile',
    'B': 'Good - Most requirements met',
    'B-': 'Above Average - Room for improvement',
    'C+': 'Average - Basic requirements met',
    'C': 'Average - Some verification needed',
    'C-': 'Below Average - Limited verification',
    'D': 'Fair - Minimal verification',
    'F': 'Poor - Not verified or incomplete',
    'N/A': 'Not rated'
  };

  class GradeBadge {
    /**
     * Create a grade badge element
     * @param {Object} gradeData - Grade data from API
     * @param {Object} options - Display options
     */
    static create(gradeData, options = {}) {
      const {
        size = 'medium', // 'small', 'medium', 'large'
        showTooltip = true,
        showBreakdown = false,
        className = ''
      } = options;

      const grade = gradeData.grade || 'N/A';
      const score = gradeData.score || 0;
      const color = gradeData.color || GRADE_COLORS[grade] || '#6b7280';
      const breakdown = gradeData.breakdown || {};

      // Create badge element
      const badge = document.createElement('span');
      badge.className = `grade-badge grade-badge-${size} ${className}`;
      badge.style.cssText = `
        background-color: ${color};
        color: white;
        padding: ${size === 'small' ? '4px 10px' : size === 'large' ? '8px 16px' : '6px 14px'};
        border-radius: ${size === 'small' ? '6px' : '8px'};
        font-size: ${size === 'small' ? '12px' : size === 'large' ? '16px' : '14px'};
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: ${showTooltip ? 'help' : 'default'};
        position: relative;
      `;
      badge.textContent = grade;

      // Add score if available
      if (score > 0 && showBreakdown) {
        badge.textContent += ` (${Math.round(score)})`;
      }

      // Add tooltip
      if (showTooltip) {
        badge.title = GRADE_DESCRIPTIONS[grade] || 'Contractor grade';

        // Create detailed tooltip on hover
        badge.addEventListener('mouseenter', function() {
          if (showBreakdown && breakdown) {
            const tooltip = GradeBadge.createTooltip(grade, score, breakdown);
            badge.appendChild(tooltip);
          }
        });

        badge.addEventListener('mouseleave', function() {
          const tooltip = badge.querySelector('.grade-tooltip');
          if (tooltip) tooltip.remove();
        });
      }

      return badge;
    }

    /**
     * Create detailed tooltip
     */
    static createTooltip(grade, score, breakdown) {
      const tooltip = document.createElement('div');
      tooltip.className = 'grade-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        background: white;
        color: #111827;
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 200px;
        z-index: 1000;
        font-weight: normal;
        font-size: 13px;
        line-height: 1.4;
        white-space: nowrap;
      `;

      tooltip.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">Grade: ${grade} (${Math.round(score)})</div>
        ${breakdown.profile_score !== undefined ? `
          <div style="margin-bottom: 4px;">
            📋 Profile: ${Math.round(breakdown.profile_score)}/100
          </div>
        ` : ''}
        ${breakdown.license_score !== undefined ? `
          <div style="margin-bottom: 4px;">
            ✓ License: ${Math.round(breakdown.license_score)}/100
          </div>
        ` : ''}
        ${breakdown.review_score !== undefined ? `
          <div>
            ⭐ Reviews: ${Math.round(breakdown.review_score)}/100
          </div>
        ` : ''}
      `;

      // Add arrow
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid white;
      `;
      tooltip.appendChild(arrow);

      return tooltip;
    }

    /**
     * Fetch and display grade for a contractor
     */
    static async fetchAndRender(contractorEmail, targetElement, options = {}) {
      try {
        const response = await fetch(`/api/contractors/${encodeURIComponent(contractorEmail)}/grade`);

        if (!response.ok) {
          throw new Error('Failed to fetch grade');
        }

        const gradeData = await response.json();

        const badge = GradeBadge.create(gradeData, options);

        // Replace or append to target
        if (typeof targetElement === 'string') {
          targetElement = document.querySelector(targetElement);
        }

        if (targetElement) {
          targetElement.innerHTML = '';
          targetElement.appendChild(badge);
        }

        return badge;

      } catch (error) {
        console.error('Error fetching grade:', error);

        // Return error badge
        const errorBadge = document.createElement('span');
        errorBadge.className = 'grade-badge';
        errorBadge.style.cssText = 'background: #6b7280; color: white; padding: 6px 14px; border-radius: 8px; font-size: 14px; font-weight: 700;';
        errorBadge.textContent = 'N/A';
        errorBadge.title = 'Grade not available';

        if (typeof targetElement === 'string') {
          targetElement = document.querySelector(targetElement);
        }

        if (targetElement) {
          targetElement.innerHTML = '';
          targetElement.appendChild(errorBadge);
        }

        return errorBadge;
      }
    }

    /**
     * Get grade color by grade letter
     */
    static getColor(grade) {
      return GRADE_COLORS[grade] || '#6b7280';
    }

    /**
     * Get grade description
     */
    static getDescription(grade) {
      return GRADE_DESCRIPTIONS[grade] || 'Not rated';
    }
  }

  // Export to global scope
  window.GradeBadge = GradeBadge;

})();
