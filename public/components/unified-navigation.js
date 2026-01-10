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
        <!-- Notification Bell -->
        <div class="relative">
          <button id="notificationBell" class="nav-notification-btn relative p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <i class="fa-solid fa-bell text-xl text-slate-600 hover:text-blue-600 transition-colors"></i>
            <span id="notificationBadge" class="notification-badge hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">0</span>
          </button>

          <!-- Notification Panel (Desktop) -->
          <div id="notificationPanel" class="hidden absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-[500px] flex flex-col">
            <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 class="font-bold text-slate-900">Notifications</h3>
              <button id="markAllReadBtn" class="text-xs text-blue-600 hover:text-blue-700 font-semibold">Mark all read</button>
            </div>
            <div id="notificationList" class="overflow-y-auto flex-1">
              <!-- Notifications will be inserted here -->
              <div class="p-8 text-center text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
                <p class="text-sm">Loading notifications...</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Dropdown -->
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
  function renderMobileNav(zone, userData = null) {
    const config = ZONE_CONFIG[zone].mobile;
    const currentPath = window.location.pathname;
    const isAuthZone = ZONE_CONFIG[zone].requiresAuth;

    let itemsHtml = config.items.map(item => {
      const isActive = currentPath === item.href || currentPath === item.href.replace(/^\//, '');
      return `
        <a href="${item.href}" class="flex flex-col items-center justify-center gap-1 flex-1 py-2 ${isActive ? 'text-blue-600' : 'text-slate-400'}">
          <i class="fa-solid ${item.icon} text-xl"></i>
          <span class="text-[10px] font-bold uppercase tracking-wide">${item.label}</span>
        </a>
      `;
    }).join('');

    // Add notification bell for authenticated users (insert before last item which is Profile)
    if (isAuthZone && userData) {
      const lastItem = config.items[config.items.length - 1];
      const isLastActive = currentPath === lastItem.href || currentPath === lastItem.href.replace(/^\//, '');

      // Remove last item from itemsHtml
      const otherItems = config.items.slice(0, -1).map(item => {
        const isActive = currentPath === item.href || currentPath === item.href.replace(/^\//, '');
        return `
          <a href="${item.href}" class="flex flex-col items-center justify-center gap-1 flex-1 py-2 ${isActive ? 'text-blue-600' : 'text-slate-400'}">
            <i class="fa-solid ${item.icon} text-xl"></i>
            <span class="text-[10px] font-bold uppercase tracking-wide">${item.label}</span>
          </a>
        `;
      }).join('');

      itemsHtml = otherItems + `
        <button onclick="toggleMobileNotifications()" class="flex flex-col items-center justify-center gap-1 flex-1 py-2 text-slate-400 relative">
          <i class="fa-solid fa-bell text-xl"></i>
          <span class="text-[10px] font-bold uppercase tracking-wide">Alerts</span>
          <span id="mobileNotificationBadge" class="notification-badge hidden absolute top-1 right-[calc(50%-12px)] bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">0</span>
        </button>
        <a href="${lastItem.href}" class="flex flex-col items-center justify-center gap-1 flex-1 py-2 ${isLastActive ? 'text-blue-600' : 'text-slate-400'}">
          <i class="fa-solid ${lastItem.icon} text-xl"></i>
          <span class="text-[10px] font-bold uppercase tracking-wide">${lastItem.label}</span>
        </a>
      `;
    }

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

        console.log(`🔐 [Navigation] Auth check for zone ${zone} (${config.name})`);

        const user = await window.authService.getCurrentUser();
        if (!user) {
          console.log('❌ [Navigation] No user found, redirecting to signin');
          // Redirect to signin
          window.location.href = '/signin.html';
          return;
        }

        console.log('✓ [Navigation] User found:', user.email);

        const profile = await window.authService.getUserProfile();
        console.log('✓ [Navigation] Profile loaded:', { role: profile?.role, email: profile?.email });

        if (config.userRole && profile.role !== config.userRole) {
          // Wrong role - redirect to appropriate dashboard
          console.log(`⚠️ [Navigation] Role mismatch! Page requires: ${config.userRole}, User is: ${profile.role}`);

          // CRITICAL FIX: Don't redirect if we're ALREADY on a dashboard or project page
          // This prevents infinite redirect loops
          const currentPath = window.location.pathname;
          const isDashboard = currentPath.includes('dashboard') || currentPath.includes('home.html');
          const isProjectPage = currentPath.includes('post-project') || currentPath.includes('project');

          if (isDashboard || isProjectPage) {
            console.log(`⏸️ [Navigation] Already on dashboard/project page (${currentPath}), skipping redirect to prevent loop`);
            // Allow navigation to render even with role mismatch
            // The page's own auth check will handle appropriate redirects
            userData = {
              email: user.email,
              name: profile.full_name || profile.company_name || user.email.split('@')[0]
            };
          } else {
            console.log(`🔄 [Navigation] Redirecting to correct dashboard for role: ${profile.role}`);
            if (profile.role === 'homeowner') {
              window.location.href = '/home.html';
            } else if (profile.role === 'contractor') {
              window.location.href = '/contractor-dashboard.html';
            }
            return;
          }
        } else {
          console.log('✅ [Navigation] Auth check passed, role matches zone requirement');
          userData = {
            email: user.email,
            name: profile.full_name || profile.company_name || user.email.split('@')[0]
          };
        }
      } catch (error) {
        console.error('❌ [Navigation] Auth check failed:', error);
        window.location.href = '/signin.html';
        return;
      }
    }

    // Render header
    const headerHtml = renderDesktopHeader(zone, userData);
    document.body.insertAdjacentHTML('afterbegin', headerHtml);

    // Render mobile nav
    const mobileNavHtml = renderMobileNav(zone, userData);
    document.body.insertAdjacentHTML('beforeend', mobileNavHtml);

    // Add padding to body for mobile nav
    document.body.classList.add('pb-20', 'md:pb-0');

    // Setup profile dropdown toggle
    if (config.desktop.rightProfile) {
      setupProfileDropdown();
      setupNotificationSystem(userData);
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
   * Setup Notification System
   */
  let notificationPollingInterval = null;
  let lastNotificationCount = 0;

  function setupNotificationSystem(userData) {
    const bellBtn = document.getElementById('notificationBell');
    const panel = document.getElementById('notificationPanel');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!bellBtn || !panel) {
      console.warn('Notification elements not found');
      return;
    }

    console.log('🔔 Initializing notification system for:', userData.email);

    // Bell button click handler
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationPanel();
    });

    // Mark all read button
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        markAllAsRead();
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !bellBtn.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    // Wait for authService to be ready before fetching notifications
    const initNotifications = () => {
      if (window.authService && window.authService.supabase) {
        console.log('✓ AuthService ready, initializing notifications');
        fetchUnreadCount();
        fetchNotifications();
        startPolling();
      } else {
        console.log('⏳ Waiting for authService to initialize...');
        setTimeout(initNotifications, 500);
      }
    };

    // Delay initial fetch to ensure authService is ready
    setTimeout(initNotifications, 1000);

    // Handle visibility change (pause polling when tab is inactive)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('⏸️ Tab inactive, pausing notification polling');
        if (notificationPollingInterval) {
          clearInterval(notificationPollingInterval);
          notificationPollingInterval = null;
        }
      } else {
        console.log('▶️ Tab active, resuming notification polling');
        // Only resume if authService is ready
        if (window.authService && window.authService.supabase) {
          fetchUnreadCount();
          fetchNotifications();
          startPolling();
        }
      }
    });
  }

  /**
   * Get Auth Token from Supabase
   */
  async function getAuthToken() {
    try {
      if (window.authService && window.authService.supabase) {
        const { data } = await window.authService.supabase.auth.getSession();
        return data?.session?.access_token;
      }
      return null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Fetch Unread Notification Count
   */
  async function fetchUnreadCount() {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for notifications');
        return;
      }

      const response = await fetch('/api/notifications/unread', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const count = data.count || 0;

      // Update desktop badge
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // Update mobile badge
      const mobileBadge = document.getElementById('mobileNotificationBadge');
      if (mobileBadge) {
        if (count > 0) {
          mobileBadge.textContent = count > 99 ? '99+' : count;
          mobileBadge.classList.remove('hidden');
        } else {
          mobileBadge.classList.add('hidden');
        }
      }

      // Show toast if count increased
      if (count > lastNotificationCount && lastNotificationCount > 0) {
        const newCount = count - lastNotificationCount;
        showToast(`You have ${newCount} new notification${newCount > 1 ? 's' : ''}`);
      }
      lastNotificationCount = count > 0 ? count : 0;

      console.log('🔔 Unread count:', count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }

  /**
   * Fetch Notifications
   */
  async function fetchNotifications() {
    const listContainer = document.getElementById('notificationList');
    if (!listContainer) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for notifications');
        return;
      }

      const response = await fetch('/api/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const notifications = await response.json();

      if (notifications.length === 0) {
        listContainer.innerHTML = `
          <div class="p-8 text-center text-slate-400">
            <i class="fa-solid fa-bell-slash text-3xl mb-2"></i>
            <p class="text-sm font-semibold">No notifications yet</p>
            <p class="text-xs mt-1">We'll notify you when something happens</p>
          </div>
        `;
        return;
      }

      // Render notifications
      listContainer.innerHTML = notifications.map(notif => {
        const icon = getNotificationIcon(notif.type);
        const timeAgo = formatNotificationTime(notif.created_at);
        const unreadClass = notif.read ? '' : 'bg-blue-50 border-l-4 border-l-blue-500';

        return `
          <div class="notification-item p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${unreadClass}"
               data-notification-id="${notif.id}"
               data-read="${notif.read}"
               onclick="handleNotificationClick('${notif.id}', '${notif.link || '#'}')">
            <div class="flex items-start gap-3">
              <div class="text-2xl flex-shrink-0">${icon}</div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-900 mb-1">${notif.title}</p>
                <p class="text-xs text-slate-600 mb-2">${notif.message}</p>
                <p class="text-xs text-slate-400">${timeAgo}</p>
              </div>
              ${!notif.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>' : ''}
            </div>
          </div>
        `;
      }).join('');

      console.log('✓ Loaded', notifications.length, 'notifications');
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      listContainer.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <i class="fa-solid fa-exclamation-triangle text-3xl mb-2"></i>
          <p class="text-sm font-semibold">Failed to load notifications</p>
          <button onclick="window.SanctuaryNavigation.refreshNotifications()" class="mt-2 text-xs text-blue-600 hover:text-blue-700">Retry</button>
        </div>
      `;
    }
  }

  /**
   * Toggle Notification Panel
   */
  function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
      panel.classList.remove('hidden');
      fetchNotifications(); // Refresh when opening
    } else {
      panel.classList.add('hidden');
    }
  }

  /**
   * Mark Notification as Read
   */
  async function markAsRead(notificationId) {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for marking notification as read');
        return;
      }

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log('✓ Marked notification as read:', notificationId);

      // Update UI
      fetchUnreadCount();
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark All Notifications as Read
   */
  async function markAllAsRead() {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for marking all notifications as read');
        return;
      }

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log('✓ Marked all notifications as read');

      // Update UI
      fetchUnreadCount();
      fetchNotifications();
      showToast('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      showToast('Failed to mark notifications as read', 'error');
    }
  }

  /**
   * Start Polling for New Notifications
   */
  function startPolling() {
    // Clear existing interval
    if (notificationPollingInterval) {
      clearInterval(notificationPollingInterval);
    }

    // Poll every 30 seconds
    notificationPollingInterval = setInterval(() => {
      if (!document.hidden) {
        fetchUnreadCount();
      }
    }, 30000);

    console.log('✓ Notification polling started (30s interval)');
  }

  /**
   * Show Toast Notification
   */
  function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.getElementById('notificationToast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast
    const toast = document.createElement('div');
    toast.id = 'notificationToast';
    toast.className = `fixed top-20 right-4 z-[60] bg-white shadow-xl rounded-xl border-l-4 ${
      type === 'error' ? 'border-l-red-500' : 'border-l-blue-500'
    } p-4 min-w-[300px] max-w-[400px] animate-slide-in-right`;

    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <i class="fa-solid ${type === 'error' ? 'fa-exclamation-circle text-red-500' : 'fa-bell text-blue-500'} text-xl flex-shrink-0"></i>
        <div class="flex-1">
          <p class="text-sm font-semibold text-slate-900">${message}</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-slate-600">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slide-out-right 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  /**
   * Format Notification Time
   */
  function formatNotificationTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return time.toLocaleDateString();
  }

  /**
   * Get Notification Icon
   */
  function getNotificationIcon(type) {
    const icons = {
      'new_bid': '💰',
      'bid_accepted': '✅',
      'bid_rejected': '❌',
      'new_job': '🔨',
      'new_message': '💬',
      'job_update': '📋',
      'payment': '💳',
      'system': 'ℹ️'
    };
    return icons[type] || '🔔';
  }

  /**
   * Handle Notification Click
   */
  window.handleNotificationClick = async function(notificationId, link) {
    // Mark as read
    await markAsRead(notificationId);

    // Navigate to link
    if (link && link !== '#') {
      window.location.href = link;
    }
  };

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

  /**
   * Toggle Mobile Notifications Panel
   */
  window.toggleMobileNotifications = function() {
    let mobilePanel = document.getElementById('mobileNotificationPanel');

    if (!mobilePanel) {
      // Create mobile notification panel (full-screen slide-up)
      mobilePanel = document.createElement('div');
      mobilePanel.id = 'mobileNotificationPanel';
      mobilePanel.className = 'fixed inset-0 bg-white z-[60] hidden md:hidden flex flex-col';
      mobilePanel.innerHTML = `
        <div class="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h2 class="text-xl font-bold text-slate-900">Notifications</h2>
          <div class="flex items-center gap-2">
            <button id="mobileMarkAllReadBtn" class="text-sm text-blue-600 hover:text-blue-700 font-semibold">Mark all read</button>
            <button onclick="toggleMobileNotifications()" class="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>
        <div id="mobileNotificationList" class="flex-1 overflow-y-auto">
          <!-- Notifications will be inserted here -->
          <div class="p-8 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p class="text-sm">Loading notifications...</p>
          </div>
        </div>
      `;

      document.body.appendChild(mobilePanel);

      // Setup mark all read button
      const mobileMarkAllBtn = document.getElementById('mobileMarkAllReadBtn');
      if (mobileMarkAllBtn) {
        mobileMarkAllBtn.addEventListener('click', () => {
          markAllAsRead();
        });
      }
    }

    // Toggle visibility with slide animation
    const isHidden = mobilePanel.classList.contains('hidden');

    if (isHidden) {
      mobilePanel.classList.remove('hidden');
      fetchMobileNotifications(); // Refresh when opening
      // Animate in
      setTimeout(() => {
        mobilePanel.style.transform = 'translateY(0)';
      }, 10);
    } else {
      // Animate out
      mobilePanel.style.transform = 'translateY(100%)';
      setTimeout(() => {
        mobilePanel.classList.add('hidden');
      }, 300);
    }
  };

  /**
   * Fetch Notifications for Mobile
   */
  async function fetchMobileNotifications() {
    const listContainer = document.getElementById('mobileNotificationList');
    if (!listContainer) return;

    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for mobile notifications');
        return;
      }

      const response = await fetch('/api/notifications?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const notifications = await response.json();

      if (notifications.length === 0) {
        listContainer.innerHTML = `
          <div class="p-8 text-center text-slate-400">
            <i class="fa-solid fa-bell-slash text-4xl mb-3"></i>
            <p class="text-base font-semibold">No notifications yet</p>
            <p class="text-sm mt-1">We'll notify you when something happens</p>
          </div>
        `;
        return;
      }

      // Render notifications (mobile-optimized)
      listContainer.innerHTML = notifications.map(notif => {
        const icon = getNotificationIcon(notif.type);
        const timeAgo = formatNotificationTime(notif.created_at);
        const unreadClass = notif.read ? '' : 'bg-blue-50 border-l-4 border-l-blue-500';

        return `
          <div class="notification-item p-4 border-b border-slate-100 active:bg-slate-100 cursor-pointer transition-colors ${unreadClass}"
               data-notification-id="${notif.id}"
               data-read="${notif.read}"
               onclick="handleMobileNotificationClick('${notif.id}', '${notif.link || '#'}')">
            <div class="flex items-start gap-3">
              <div class="text-3xl flex-shrink-0">${icon}</div>
              <div class="flex-1 min-w-0">
                <p class="text-base font-semibold text-slate-900 mb-1">${notif.title}</p>
                <p class="text-sm text-slate-600 mb-2">${notif.message}</p>
                <p class="text-xs text-slate-400">${timeAgo}</p>
              </div>
              ${!notif.read ? '<div class="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>' : ''}
            </div>
          </div>
        `;
      }).join('');

      console.log('✓ Loaded', notifications.length, 'mobile notifications');
    } catch (error) {
      console.error('Failed to fetch mobile notifications:', error);
      listContainer.innerHTML = `
        <div class="p-8 text-center text-red-400">
          <i class="fa-solid fa-exclamation-triangle text-4xl mb-3"></i>
          <p class="text-base font-semibold">Failed to load notifications</p>
          <button onclick="fetchMobileNotifications()" class="mt-3 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg">Retry</button>
        </div>
      `;
    }
  }

  /**
   * Handle Mobile Notification Click
   */
  window.handleMobileNotificationClick = async function(notificationId, link) {
    // Mark as read
    await markAsRead(notificationId);

    // Close panel
    toggleMobileNotifications();

    // Navigate to link
    if (link && link !== '#') {
      setTimeout(() => {
        window.location.href = link;
      }, 300);
    }
  };

  // Export to global scope
  window.SanctuaryNavigation = {
    init: initNavigation,
    zones: Object.keys(ZONE_CONFIG),
    refreshNotifications: fetchNotifications
  };

  console.log('✓ Sanctuary Glass 2.0 Navigation System loaded');
})();
