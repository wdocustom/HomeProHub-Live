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
        <footer class="bg-slate-900 text-white mt-20">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-12">
              <!-- Brand Column -->
              <div class="footer-brand">
                <a href="/index.html" class="text-2xl font-extrabold text-white tracking-tight hover:text-blue-400 transition-colors flex items-center gap-2 mb-4">
                  <i class="fa-solid fa-house-circle-check text-blue-400"></i>
                  HomeProHub
                </a>
                <p class="text-slate-400 text-sm leading-relaxed">Building trust through transparency.<br>Connecting homeowners with verified contractors.</p>
              </div>

              <!-- Product Column -->
              <div>
                <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Product</h3>
                <ul class="space-y-3">
                  <li><a href="/index.html" class="text-slate-400 hover:text-white transition-colors text-sm">For Homeowners</a></li>
                  <li><a href="/contractors.html" class="text-slate-400 hover:text-white transition-colors text-sm">For Contractors</a></li>
                  <li><a href="/homeowner-estimator.html" class="text-slate-400 hover:text-white transition-colors text-sm">Renovation Planner</a></li>
                  <li><a href="/contractor-directory.html" class="text-slate-400 hover:text-white transition-colors text-sm">Find a Pro</a></li>
                  <li><a href="/grading-details.html" class="text-slate-400 hover:text-white transition-colors text-sm">Verification</a></li>
                </ul>
              </div>

              <!-- Company Column -->
              <div>
                <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Company</h3>
                <ul class="space-y-3">
                  <li><a href="/about.html" class="text-slate-400 hover:text-white transition-colors text-sm">About Us</a></li>
                  <li><a href="/about.html#contact" class="text-slate-400 hover:text-white transition-colors text-sm">Contact</a></li>
                  <li><a href="mailto:support@homeprohub.com" class="text-slate-400 hover:text-white transition-colors text-sm">Support</a></li>
                </ul>
              </div>

              <!-- Legal Column -->
              <div>
                <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4">Legal</h3>
                <ul class="space-y-3">
                  <li><a href="/terms.html" class="text-slate-400 hover:text-white transition-colors text-sm">Terms of Service</a></li>
                  <li><a href="/privacy.html" class="text-slate-400 hover:text-white transition-colors text-sm">Privacy Policy</a></li>
                </ul>
              </div>
            </div>

            <!-- Copyright -->
            <div class="border-t border-slate-800 mt-12 pt-8">
              <p class="text-slate-400 text-sm text-center">
                © ${new Date().getFullYear()} <strong class="text-white">HomeProHub</strong>. Built by a Marine Corps veteran and Class A contractor. Trust is the feature.
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
