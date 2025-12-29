/**
 * HomeProHub Global Footer Component
 * Responsive footer with multi-column layout
 */

(function() {
  'use strict';

  class GlobalFooter {
    constructor() {
      this.init();
    }

    createFooterHTML() {
      return `
        <footer class="global-footer">
          <div class="footer-container">
            <div class="footer-grid">
              <!-- Brand Column -->
              <div class="footer-column footer-brand">
                <a href="index.html" class="footer-logo">
                  <span class="footer-logo-icon">🏠</span>
                  <span>HomeProHub</span>
                </a>
                <p class="footer-tagline">Building trust through transparency.</p>
              </div>

              <!-- Product Column -->
              <div class="footer-column">
                <h3>Product</h3>
                <ul class="footer-links">
                  <li><a href="home.html">Homeowners</a></li>
                  <li><a href="contractor.html">Contractors</a></li>
                  <li><a href="pricing-estimator.html">Pricing</a></li>
                  <li><a href="ask.html">AI Assistant</a></li>
                </ul>
              </div>

              <!-- Company Column -->
              <div class="footer-column">
                <h3>Company</h3>
                <ul class="footer-links">
                  <li><a href="#about">About Us</a></li>
                  <li><a href="#contact">Contact</a></li>
                  <li><a href="#support">Support</a></li>
                </ul>
              </div>

              <!-- Legal Column -->
              <div class="footer-column">
                <h3>Legal</h3>
                <ul class="footer-links">
                  <li><a href="#terms">Terms of Service</a></li>
                  <li><a href="#privacy">Privacy Policy</a></li>
                  <li><a href="#contractor-agreement">Contractor Agreement</a></li>
                </ul>
              </div>
            </div>

            <!-- Copyright -->
            <div class="footer-bottom">
              <p class="footer-copyright">
                © 2025 <strong>HomeProHub</strong>. Trust is the feature.
              </p>
            </div>
          </div>
        </footer>
      `;
    }

    init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.render());
      } else {
        this.render();
      }
    }

    render() {
      const footerHTML = this.createFooterHTML();

      // Insert footer before the closing body tag
      document.body.insertAdjacentHTML('beforeend', footerHTML);
    }
  }

  // Initialize footer
  window.homeprohubFooter = new GlobalFooter();
})();
