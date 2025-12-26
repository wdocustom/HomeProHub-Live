/**
 * HomeProHub License Badge Component
 * Generates license verification badges for contractors
 */

(function() {
  'use strict';

  /**
   * Generate HTML for license badge based on verification status
   * @param {Object} contractor - Contractor profile object
   * @param {Object} options - Display options {size: 'compact'|'normal'|'large', showTooltip: boolean, showGetLicensed: boolean}
   * @returns {string} HTML string for license badge
   */
  window.generateLicenseBadge = function(contractor, options = {}) {
    const size = options.size || 'normal';
    const showTooltip = options.showTooltip !== false;
    const showGetLicensed = options.showGetLicensed !== false;

    // Determine license status
    const hasLicense = contractor.licenseNumber || contractor.license || contractor.licNumber;
    const licenseState = contractor.licState || contractor.license_state;
    const verified = contractor.licenseVerified || contractor.license_verified;

    let badgeClass = 'license-badge';
    let icon = '';
    let text = '';
    let statusClass = '';
    let tooltipText = '';

    if (verified === 'verified') {
      // Verified license
      statusClass = 'license-badge-verified';
      icon = '✓';
      text = 'Verified';
      tooltipText = `Licensed in ${licenseState || 'state'} • License ${hasLicense} • Verified by HomeProHub`;
    } else if (verified === 'pending') {
      // Pending verification
      statusClass = 'license-badge-pending';
      icon = '⏳';
      text = 'Pending';
      tooltipText = 'License verification in progress';
    } else if (hasLicense && licenseState) {
      // Has license info but not verified
      statusClass = 'license-badge-unverified';
      icon = '📋';
      text = 'Unverified';
      tooltipText = `License ${hasLicense} in ${licenseState} • Not yet verified`;
    } else if (showGetLicensed) {
      // Not licensed - show Get Licensed prompt
      return `
        <a href="https://www.contractortrainingcenter.com/?ref=homeprohub"
           target="_blank"
           rel="noopener"
           class="license-badge license-badge-get-licensed ${size === 'compact' ? 'license-badge-compact' : size === 'large' ? 'license-badge-large' : ''}"
           title="Get licensed through our partner">
          <span class="license-badge-icon">🎓</span>
          <span class="license-badge-text">Get Licensed</span>
        </a>
      `;
    } else {
      // Not licensed - simple display
      statusClass = 'license-badge-unverified';
      icon = '—';
      text = 'Unlicensed';
      tooltipText = 'No license on file';
    }

    // Build size class
    const sizeClass = size === 'compact' ? 'license-badge-compact' : size === 'large' ? 'license-badge-large' : '';

    // Build badge HTML
    let badgeHTML = `
      <span class="${badgeClass} ${statusClass} ${sizeClass}">
        <span class="license-badge-icon">${icon}</span>
        <span class="license-badge-text">${text}</span>
      </span>
    `;

    // Wrap with tooltip if enabled
    if (showTooltip && tooltipText) {
      badgeHTML = `
        <span class="license-badge-wrapper">
          ${badgeHTML}
          <span class="license-badge-tooltip">${tooltipText}</span>
        </span>
      `;
    }

    return badgeHTML;
  };

  /**
   * Generate detailed license info card
   * @param {Object} contractor - Contractor profile object
   * @returns {string} HTML string for license info card
   */
  window.generateLicenseInfoCard = function(contractor) {
    const hasLicense = contractor.licenseNumber || contractor.license || contractor.licNumber;
    const licenseState = contractor.licState || contractor.license_state;
    const licenseType = contractor.licType || contractor.license_type;
    const licenseExpiration = contractor.licExpiration || contractor.license_expiration;
    const verified = contractor.licenseVerified || contractor.license_verified;

    if (!hasLicense || !licenseState) {
      return `
        <div class="license-info-card" style="background: #fef3c7; border-color: #fbbf24;">
          <div class="license-info-card-header">
            <span style="font-size: 20px;">📜</span>
            <span class="license-info-card-title">Not Licensed</span>
          </div>
          <p style="margin: 0; font-size: 13px; color: #78350f;">
            This contractor hasn't provided license information yet.
          </p>
        </div>
      `;
    }

    const statusIcon = verified === 'verified' ? '✅' : verified === 'pending' ? '⏳' : '📋';
    const statusText = verified === 'verified' ? 'Verified' : verified === 'pending' ? 'Pending Verification' : 'Unverified';
    const statusColor = verified === 'verified' ? '#065f46' : verified === 'pending' ? '#92400e' : '#6b7280';

    return `
      <div class="license-info-card">
        <div class="license-info-card-header">
          <span style="font-size: 20px;">${statusIcon}</span>
          <span class="license-info-card-title" style="color: ${statusColor};">${statusText}</span>
        </div>
        <div class="license-info-card-row">
          <span class="license-info-card-label">License Number:</span>
          <span class="license-info-card-value">${hasLicense}</span>
        </div>
        <div class="license-info-card-row">
          <span class="license-info-card-label">State:</span>
          <span class="license-info-card-value">${licenseState}</span>
        </div>
        ${licenseType ? `
        <div class="license-info-card-row">
          <span class="license-info-card-label">Type:</span>
          <span class="license-info-card-value">${licenseType}</span>
        </div>
        ` : ''}
        ${licenseExpiration ? `
        <div class="license-info-card-row">
          <span class="license-info-card-label">Expires:</span>
          <span class="license-info-card-value">${new Date(licenseExpiration).toLocaleDateString()}</span>
        </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Check if contractor is verified
   * @param {Object} contractor - Contractor profile object
   * @returns {boolean} True if verified
   */
  window.isContractorVerified = function(contractor) {
    const verified = contractor.licenseVerified || contractor.license_verified;
    return verified === 'verified';
  };

  /**
   * Get contractor verification status
   * @param {Object} contractor - Contractor profile object
   * @returns {string} 'verified', 'pending', 'unverified', or 'none'
   */
  window.getContractorVerificationStatus = function(contractor) {
    const hasLicense = contractor.licenseNumber || contractor.license || contractor.licNumber;
    const verified = contractor.licenseVerified || contractor.license_verified;

    if (verified === 'verified') return 'verified';
    if (verified === 'pending') return 'pending';
    if (hasLicense) return 'unverified';
    return 'none';
  };

})();
