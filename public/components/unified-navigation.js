/**
 * Sanctuary Glass 2.0 - Unified Navigation System
 * Zone-based navigation for HomeProHub
 *
 * Zones:
 * A - Public Homeowner (Guest)
 * B - Public Contractor (Guest)
 * C - Homeowner App (Logged In)
 * D - Contractor App (Logged In)
 */

(function() {
  'use strict';

  // Zone Configuration
  const ZONE_CONFIG = {
    A: {
      name: 'Public Homeowner',
      desktop: {
        logo: { text: 'HomeProHub', href: '/index.html' },
        centerLinks: [
          { text: 'How it Works', href: '/index.html#how-it-works' },
          { text: 'Verification', href: '/grading-details.html' },
          { text: 'Directory', href: '/contractor-directory.html' }
        ],
        rightButton: { text: 'Sign In', href: '/signin.html', style: 'button' }
      },
      mobile: {
        items: [
          { label: 'How it Works', icon: 'fa-circle-info', href: '/index.html#how-it-works' },
          { label: 'Verification', icon: 'fa-certificate', href: '/grading-details.html' },
          { label: 'Directory', icon: 'fa-users', href: '/contractor-directory.html' },
          { label: 'Sign In', icon: 'fa-arrow-right', href: '/signin.html' }
        ]
      }
    },
    B: {
      name: 'Public Contractor',
      desktop: {
        logo: { text: 'HomeProHub', href: '/index.html' },
        centerLinks: [
          { text: 'For Homeowners', href: '/index.html' },
          { text: 'For Contractors', href: '/contractors.html' },
          { text: 'Verification', href: '/grading-details.html' }
        ],
        rightButton: { text: 'Sign In', href: '/signin.html', style: 'button' }
      },
      mobile: {
        items: [
          { label: 'Homeowners', icon: 'fa-home', href: '/index.html' },
          { label: 'Contractors', icon: 'fa-hammer', href: '/contractors.html' },
          { label: 'Verification', icon: 'fa-certificate', href: '/grading-details.html' },
          { label: 'Sign In', icon: 'fa-arrow-right', href: '/signin.html' }
        ]
      }
    },
    C: {
      name: 'Homeowner App',
      requiresAuth: true,
      userRole: 'homeowner',
      desktop: {
        logo: { text: 'HomeProHub', href: '/home.html' },
        centerLinks: [
          { text: 'Dashboard', href: '/home.html' },
          { text: 'Projects', href: '/homeowner-dashboard.html' },
          { text: 'Progress', href: '/project-check-in.html' },
          { text: 'Messages', href: '/messages.html' }
        ],
        rightProfile: true
      },
      mobile: {
        items: [
          { label: 'Dashboard', icon: 'fa-home', href: '/home.html' },
          { label: 'Projects', icon: 'fa-list', href: '/homeowner-dashboard.html' },
          { label: 'Progress', icon: 'fa-chart-line', href: '/project-check-in.html' },
          { label: 'Messages', icon: 'fa-message', href: '/messages.html' },
          { label: 'Profile', icon: 'fa-user', href: '/homeowner-profile.html' }
        ]
      }
    },
    D: {
      name: 'Contractor App',
      requiresAuth: true,
      userRole: 'contractor',
      desktop: {
        logo: { text: 'HomeProHub', href: '/contractor-dashboard.html' },
        centerLinks: [
          { text: 'Dashboard', href: '/contractor-dashboard.html' },
          { text: 'Tools', href: '/pricing-estimator.html' },
          { text: 'Job Board', href: '/job-board.html' },
          { text: 'Messages', href: '/messages.html' }
        ],
        rightProfile: true
      },
      mobile: {
        items: [
          { label: 'Dashboard', icon: 'fa-home', href: '/contractor-dashboard.html' },
          { label: 'Tools', icon: 'fa-wrench', href: '/pricing-estimator.html' },
          { label: 'Job Board', icon: 'fa-briefcase', href: '/job-board.html' },
          { label: 'Messages', icon: 'fa-message', href: '/messages.html' },
          { label: 'Profile', icon: 'fa-user', href: '/contractor-profile.html' }
        ]
      }
    }
  };

  /**
   * Render Desktop Header
   */
  function renderDesktopHeader(zone, userData = null) {
    const config = ZONE_CONFIG[zone].desktop;

    const centerLinksHtml = config.centerLinks.map(link => {
      const isActive = window.location.pathname === link.href ||
                       window.location.pathname === link.href.replace(/^\//, '');
      return `<a href="${link.href}" class="text-slate-700 hover:text-blue-600 font-semibold transition-colors ${isActive ? 'text-blue-600' : ''}">${link.text}</a>`;
    }).join('');

    let rightSectionHtml = '';
    if (config.rightButton) {
      rightSectionHtml = `
        <a href="${config.rightButton.href}"
           class="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 hover:scale-105 transition-all">
          ${config.rightButton.text}
        </a>
      `;
    } else if (config.rightProfile && userData) {
      rightSectionHtml = `
        <div class="relative">
          <button id="profileDropdownBtn" class="flex items-center gap-3 hover:bg-slate-50 rounded-xl px-4 py-2 transition-colors">
            <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              ${(userData.name || userData.email || 'U').charAt(0).toUpperCase()}
            </div>
            <span class="font-semibold text-slate-900 hidden lg:block">${userData.name || userData.email || 'User'}</span>
            <i class="fa-solid fa-chevron-down text-slate-400 text-sm"></i>
          </button>
          <div id="profileDropdown" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
            <a href="${zone === 'C' ? '/homeowner-profile.html' : '/contractor-profile.html'}"
               class="block px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100">
              <div class="font-semibold text-slate-900">My Profile</div>
              <div class="text-sm text-slate-500">${userData.email || ''}</div>
            </a>
            <a href="#" class="block px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100">
              <div class="font-semibold text-slate-900">Settings</div>
            </a>
            <button onclick="handleLogout()" class="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors">
              <div class="font-semibold text-red-600">Logout</div>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <header class="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-xl bg-white/95">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <!-- Logo -->
            <a href="${config.logo.href}" class="text-xl font-extrabold text-slate-900 tracking-tight hover:text-blue-600 transition-colors">
              ${config.logo.text}
            </a>

            <!-- Center Links (Desktop Only) -->
            <nav class="hidden md:flex items-center gap-8">
              ${centerLinksHtml}
            </nav>

            <!-- Right Section -->
            <div class="hidden md:block">
              ${rightSectionHtml}
            </div>

            <!-- Mobile Menu Button -->
            <button class="md:hidden p-2 text-slate-600" onclick="toggleMobileMenu()">
              <i class="fa-solid fa-bars text-xl"></i>
            </button>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Render Mobile Bottom Navigation
   */
  function renderMobileNav(zone) {
    const config = ZONE_CONFIG[zone].mobile;
    const currentPath = window.location.pathname;

    const itemsHtml = config.items.map(item => {
      const isActive = currentPath === item.href || currentPath === item.href.replace(/^\//, '');
      return `
        <a href="${item.href}" class="flex flex-col items-center justify-center gap-1 flex-1 py-2 ${isActive ? 'text-blue-600' : 'text-slate-400'}">
          <i class="fa-solid ${item.icon} text-xl"></i>
          <span class="text-[10px] font-bold uppercase tracking-wide">${item.label}</span>
        </a>
      `;
    }).join('');

    return `
      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-safe z-50">
        <div class="flex items-center justify-around">
          ${itemsHtml}
        </div>
      </nav>
    `;
  }

  /**
   * Initialize Navigation
   */
  async function initNavigation(zone) {
    if (!ZONE_CONFIG[zone]) {
      console.error(`Invalid navigation zone: ${zone}`);
      return;
    }

    const config = ZONE_CONFIG[zone];
    let userData = null;

    // Check auth for protected zones
    if (config.requiresAuth) {
      try {
        // Wait for authService to be ready
        if (!window.authService || !window.authService.initialized) {
          await new Promise(resolve => {
            const checkAuth = setInterval(() => {
              if (window.authService && window.authService.initialized) {
                clearInterval(checkAuth);
                resolve();
              }
            }, 100);
          });
        }

        const user = await window.authService.getCurrentUser();
        if (!user) {
          // Redirect to signin
          window.location.href = '/signin.html';
          return;
        }

        const profile = await window.authService.getUserProfile();
        if (config.userRole && profile.role !== config.userRole) {
          // Wrong role - redirect to appropriate dashboard
          if (profile.role === 'homeowner') {
            window.location.href = '/homeowner-dashboard.html';
          } else if (profile.role === 'contractor') {
            window.location.href = '/contractor-dashboard.html';
          }
          return;
        }

        userData = {
          email: user.email,
          name: profile.full_name || profile.company_name || user.email.split('@')[0]
        };
      } catch (error) {
        console.error('Navigation auth check failed:', error);
        window.location.href = '/signin.html';
        return;
      }
    }

    // Render header
    const headerHtml = renderDesktopHeader(zone, userData);
    document.body.insertAdjacentHTML('afterbegin', headerHtml);

    // Render mobile nav
    const mobileNavHtml = renderMobileNav(zone);
    document.body.insertAdjacentHTML('beforeend', mobileNavHtml);

    // Add padding to body for mobile nav
    document.body.classList.add('pb-20', 'md:pb-0');

    // Setup profile dropdown toggle
    if (config.desktop.rightProfile) {
      setupProfileDropdown();
    }
  }

  /**
   * Setup Profile Dropdown
   */
  function setupProfileDropdown() {
    const btn = document.getElementById('profileDropdownBtn');
    const dropdown = document.getElementById('profileDropdown');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  /**
   * Handle Logout
   */
  window.handleLogout = async function() {
    try {
      if (window.authService) {
        await window.authService.logout();
      }
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/index.html';
    }
  };

  /**
   * Toggle Mobile Menu
   */
  window.toggleMobileMenu = function() {
    let mobileMenu = document.getElementById('mobileMenuOverlay');

    if (!mobileMenu) {
      // Create mobile menu overlay
      const zone = document.body.className.match(/zone-([a-d])/i)?.[1].toUpperCase() || 'A';
      const config = ZONE_CONFIG[zone];

      if (!config) return;

      mobileMenu = document.createElement('div');
      mobileMenu.id = 'mobileMenuOverlay';
      mobileMenu.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden md:hidden';
      mobileMenu.innerHTML = `
        <div class="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl">
          <div class="p-6 border-b border-slate-200 flex items-center justify-between">
            <h2 class="text-xl font-bold text-slate-900">Menu</h2>
            <button onclick="toggleMobileMenu()" class="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          <nav class="p-6 space-y-2">
            ${config.desktop.centerLinks.map(link => `
              <a href="${link.href}"
                 class="block px-4 py-3 text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl font-semibold transition-colors">
                ${link.text}
              </a>
            `).join('')}
            ${config.rightButton ? `
              <a href="${config.rightButton.href}"
                 class="block px-4 py-3 bg-blue-600 text-white text-center rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors">
                ${config.rightButton.text}
              </a>
            ` : ''}
          </nav>
        </div>
      `;

      document.body.appendChild(mobileMenu);

      // Close on overlay click
      mobileMenu.addEventListener('click', (e) => {
        if (e.target === mobileMenu) {
          toggleMobileMenu();
        }
      });
    }

    // Toggle visibility
    mobileMenu.classList.toggle('hidden');
  };

  // Export to global scope
  window.SanctuaryNavigation = {
    init: initNavigation,
    zones: Object.keys(ZONE_CONFIG)
  };

  console.log('✓ Sanctuary Glass 2.0 Navigation System loaded');
})();
