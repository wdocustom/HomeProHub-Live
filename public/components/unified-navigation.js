/**
 * HomeProHub Unified Navigation System
 * Zone-based navigation for role-specific user experiences
 * REFACTORED: Removed legacy branding, improved error handling
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
        logo: { text: 'HomeProHub', href: '/homeowner-dashboard.html' },
        centerLinks: [
          { text: 'Dashboard', href: '/homeowner-dashboard.html' },
          { text: 'Projects', href: '/homeowner-projects.html' },
          { text: 'Messages', href: '/messages.html' }
        ],
        rightProfile: true
      },
      mobile: {
        items: [
          { label: 'Dashboard', icon: 'fa-home', href: '/homeowner-dashboard.html' },
          { label: 'Projects', icon: 'fa-list', href: '/homeowner-projects.html' },
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
          { text: 'Tools', href: '/contractor-tools.html' },
          { text: 'Job Board', href: '/job-board.html' },
          { text: 'Messages', href: '/messages.html' }
        ],
        rightProfile: true
      },
      mobile: {
        items: [
          { label: 'Dashboard', icon: 'fa-home', href: '/contractor-dashboard.html' },
          { label: 'Tools', icon: 'fa-wrench', href: '/contractor-tools.html' },
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
        <div class="flex items-center gap-3">
          
          <div class="relative">
            <button id="notificationBell" class="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" title="Notifications">
              <i class="fa-regular fa-bell text-xl"></i>
              <span id="notificationBadge" class="hidden absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>

            <div id="notificationPanel" class="hidden absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right transition-all">
              <div class="p-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 class="font-bold text-slate-800 text-sm">Notifications</h3>
                <button id="markAllReadBtn" class="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all read</button>
              </div>
              <div id="notificationList" class="max-h-[400px] overflow-y-auto">
                <div class="p-8 text-center text-slate-400">
                  <i class="fa-solid fa-spinner fa-spin text-xl mb-2"></i>
                  <p class="text-xs">Loading...</p>
                </div>
              </div>
            </div>
          </div>

          <div class="h-6 w-px bg-slate-200 hidden md:block"></div>

          <div class="relative">
            <button id="profileDropdownBtn" class="flex items-center gap-2 pl-1 pr-2 py-1 hover:bg-slate-50 rounded-full border border-transparent hover:border-slate-200 transition-all">
              <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                ${(userData.name || userData.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span class="font-semibold text-slate-700 text-sm hidden lg:block max-w-[100px] truncate">
                ${userData.name || 'User'}
              </span>
              <i class="fa-solid fa-chevron-down text-slate-400 text-xs hidden lg:block"></i>
            </button>
            
            <div id="profileDropdown" class="hidden absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right">
              <div class="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                <p class="text-sm font-bold text-slate-900 truncate">${userData.name || 'User'}</p>
                <p class="text-xs text-slate-500 truncate">${userData.email}</p>
              </div>
              <a href="${zone === 'C' ? '/homeowner-profile.html' : '/contractor-profile.html'}" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <i class="fa-regular fa-user mr-2"></i> Profile
              </a>
              <a href="#" class="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <i class="fa-regular fa-credit-card mr-2"></i> Billing
              </a>
              <div class="border-t border-slate-50 my-1"></div>
              <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <i class="fa-solid fa-arrow-right-from-bracket mr-2"></i> Sign Out
              </button>
            </div>
          </div>

        </div>
      `;
    }

    return `
      <header class="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-xl bg-white/95">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <a href="${config.logo.href}" class="text-xl font-extrabold text-slate-900 tracking-tight hover:text-blue-600 transition-colors">
              ${config.logo.text}
            </a>

            <nav class="hidden md:flex items-center gap-8">
              ${centerLinksHtml}
            </nav>

            <div class="hidden md:block">
              ${rightSectionHtml}
            </div>

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

    // Add notification bell for authenticated users (mobile logic)
    if (isAuthZone && userData) {
      const lastItem = config.items[config.items.length - 1];
      const isLastActive = currentPath === lastItem.href || currentPath === lastItem.href.replace(/^\//, '');
      
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
          <span id="mobileNotificationBadge" class="hidden absolute top-1 right-[calc(50%-12px)] h-2.5 w-2.5 bg-red-500 border-2 border-white rounded-full"></span>
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

  // --- Passive Navigation Initializer (No Auth Logic) ---
  // This component ONLY renders UI. Auth is handled by app-controller.js

  async function initNavigation(zone, userData = null) {
    if (!ZONE_CONFIG[zone]) return console.error(`Invalid zone: ${zone}`);
    const config = ZONE_CONFIG[zone];

    // Navigation is now a "dumb" component - it trusts the data passed from app-controller
    // No auth fetching happens here to prevent race conditions

    // Header Injection
    let headerContainer = document.getElementById('main-header-container');
    if (!headerContainer) {
      headerContainer = document.createElement('header'); // Fallback creation if not in HTML
      headerContainer.id = 'main-header-container';
      headerContainer.className = 'sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300';
      document.body.prepend(headerContainer);
    }
    headerContainer.innerHTML = renderDesktopHeader(zone, userData);

    // Mobile Nav Injection
    let mobileContainer = document.getElementById('mobile-nav-container');
    if (!mobileContainer) {
      mobileContainer = document.createElement('div');
      mobileContainer.id = 'mobile-nav-container';
      mobileContainer.className = 'md:hidden fixed bottom-0 left-0 right-0 z-50';
      document.body.appendChild(mobileContainer);
    }
    mobileContainer.innerHTML = renderMobileNav(zone, userData);

    document.body.classList.add('pb-20', 'md:pb-0');

    if (config.desktop.rightProfile) {
      setupProfileDropdown();
      setupNotificationSystem(userData);
    }
  }

  function setupProfileDropdown() {
    const btn = document.getElementById('profileDropdownBtn');
    const dropdown = document.getElementById('profileDropdown');
    if (!btn || !dropdown) return;
    btn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !btn.contains(e.target)) dropdown.classList.add('hidden');
    });
  }

  // --- Notification System Logic ---
  let notificationPollingInterval = null;
  let lastNotificationCount = 0;

  function setupNotificationSystem(userData) {
    const bellBtn = document.getElementById('notificationBell');
    const panel = document.getElementById('notificationPanel');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!bellBtn || !panel) return;

    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleNotificationPanel(); });
    if (markAllBtn) markAllBtn.addEventListener('click', markAllAsRead);
    
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !bellBtn.contains(e.target)) panel.classList.add('hidden');
    });

    const initNotifications = () => {
      if (window.authService && window.authService.supabase) {
        fetchUnreadCount();
        fetchNotifications();
        startPolling();
      } else {
        setTimeout(initNotifications, 500);
      }
    };
    setTimeout(initNotifications, 1000);
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (notificationPollingInterval) clearInterval(notificationPollingInterval);
      } else {
         if (window.authService) startPolling();
      }
    });
  }

  async function getAuthToken() {
    if (window.authService && window.authService.supabase) {
      const { data } = await window.authService.supabase.auth.getSession();
      return data?.session?.access_token;
    }
    return null;
  }

  async function fetchUnreadCount() {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const response = await fetch('/api/notifications/unread', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const count = data.count || 0;

      const badge = document.getElementById('notificationBadge');
      const mobileBadge = document.getElementById('mobileNotificationBadge');

      // Show red dot indicator instead of count
      const updateBadge = (el) => {
          if(!el) return;
          if(count > 0) {
              el.classList.remove('hidden');
          } else {
              el.classList.add('hidden');
          }
      };

      updateBadge(badge);
      updateBadge(mobileBadge);

      if (count > lastNotificationCount && lastNotificationCount > 0) {
        showToast(`You have ${count - lastNotificationCount} new notifications`);
      }
      lastNotificationCount = count;
    } catch (error) { console.error(error); }
  }

  async function fetchNotifications() {
    const listContainer = document.getElementById('notificationList');
    if (!listContainer) return;
    try {
      const token = await getAuthToken();
      if (!token) return;
      const response = await fetch('/api/notifications?limit=20', { headers: { 'Authorization': `Bearer ${token}` } });
      const notifications = await response.json();

      if (!notifications.length) {
        listContainer.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fa-regular fa-bell-slash text-2xl mb-2"></i><p class="text-xs">No notifications yet</p></div>`;
        return;
      }

      listContainer.innerHTML = notifications.map(notif => `
        <div class="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}"
             onclick="handleNotificationClick('${notif.id}', '${notif.action_url || '#'}')">
          <div class="flex items-start gap-3">
             <div class="text-xl">${getNotificationIcon(notif.notification_type || notif.type)}</div>
             <div class="flex-1 min-w-0">
               <p class="text-sm font-semibold text-slate-900 mb-0.5">${notif.title}</p>
               <p class="text-xs text-slate-500 line-clamp-2">${notif.message}</p>
               <p class="text-[10px] text-slate-400 mt-1">${formatNotificationTime(notif.created_at)}</p>
             </div>
             ${!notif.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>' : ''}
          </div>
        </div>
      `).join('');
    } catch (error) {
       listContainer.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Failed to load</div>`;
    }
  }

  function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if(panel) {
        panel.classList.toggle('hidden');
        if(!panel.classList.contains('hidden')) fetchNotifications();
    }
  }

  async function markAsRead(notificationId) {
     try {
         const token = await getAuthToken();
         await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
         fetchUnreadCount();
     } catch(e) {}
  }
  
  async function markAllAsRead() {
     try {
         const token = await getAuthToken();
         await fetch(`/api/notifications/mark-all-read`, { method: 'POST', headers: {'Authorization': `Bearer ${token}`} });
         fetchUnreadCount();
         fetchNotifications();
     } catch(e) {}
  }

  function startPolling() {
    if (notificationPollingInterval) clearInterval(notificationPollingInterval);
    notificationPollingInterval = setInterval(() => { if(!document.hidden) fetchUnreadCount(); }, 30000);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 right-4 z-[100] bg-white shadow-xl rounded-xl border-l-4 border-blue-500 p-4 animate-slide-in';
    toast.innerHTML = `<p class="text-sm font-semibold">${message}</p>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function formatNotificationTime(timestamp) {
     const diff = Date.now() - new Date(timestamp);
     const mins = Math.floor(diff/60000);
     if(mins < 60) return `${mins}m ago`;
     const hours = Math.floor(mins/60);
     if(hours < 24) return `${hours}h ago`;
     return `${Math.floor(hours/24)}d ago`;
  }

  function getNotificationIcon(type) {
    const icons = { 'new_bid': '💰', 'bid_accepted': '✅', 'new_message': '💬', 'system': 'ℹ️' };
    return icons[type] || '🔔';
  }

  window.handleNotificationClick = async function(id, link) {
    await markAsRead(id);
    if(link && link !== '#') window.location.href = link;
  };

  // --- ROBUST LOGOUT HANDLER ---
  // Tries both logout() and signOut() to match Supabase/Auth wrapper standards
  window.handleLogout = async function() {
    // DEBUG: Add stack trace to see what's calling logout
    console.log("🚪 Logging out...");
    console.trace("Logout triggered from:");

    try {
      if (window.authService) {
        // 1. Try 'logout' (Custom Wrapper)
        if (typeof window.authService.logout === 'function') {
           await window.authService.logout();
        }
        // 2. Try 'signOut' (Supabase Standard)
        else if (typeof window.authService.signOut === 'function') {
           await window.authService.signOut();
        }
        else {
           console.warn("AuthService missing logout function, forcing redirect");
        }
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
    // Force redirect regardless of API success
    window.location.href = '/index.html';
  };

  window.toggleMobileMenu = function() {
     alert("Mobile menu toggle"); 
  };
  
  window.toggleMobileNotifications = function() {
      // Logic handled in separate script or redundant
  };

  function startNavigationSystem() {
    console.warn('⚠️ startNavigationSystem() is deprecated. Use initNavigation(zone, userData) from app-controller.js instead.');
    const zoneMeta = document.querySelector('meta[name="sanctuary-zone"]');
    let zone = zoneMeta ? zoneMeta.content : 'A';
    const user = window.currentUser;

    let userData = null;
    if (user) {
      userData = {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.company_name || user.email.split('@')[0]
      };
      if (zone === 'A' || zone === 'B') {
        const role = user.user_metadata?.role || 'homeowner';
        zone = role === 'contractor' ? 'D' : 'C';
      }
    }
    initNavigation(zone, userData);
  }

  // Export navigation API
  const navigationAPI = {
    init: initNavigation,
    zones: Object.keys(ZONE_CONFIG),
    refreshNotifications: fetchNotifications
  };

  // Export under both names for backward compatibility
  window.UnifiedNavigation = navigationAPI;
  window.SanctuaryNavigation = navigationAPI; // Legacy support

  console.log('✓ HomeProHub Navigation System loaded');
})();
