/**
 * HomeProHub Unified Navigation Component
 * Smart top navigation with role-based links and notifications
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    USERNAME: 'homeprohub_username',
    AUTH_TOKEN: 'homeprohub_auth_token',
    USER_ROLE: 'homeprohub_user_role'
  };

  // Navigation configuration by role
  const NAV_CONFIG = {
    homeowner: [
      { label: 'Home', href: 'home.html', icon: '🏠' },
      { label: 'AI Assistant', href: 'ask.html', icon: '🤖' },
      { label: 'Post a Job', href: 'homeowner-dashboard.html', icon: '➕' },
      { label: 'Messages', href: 'messages.html', icon: '💬', badge: 'messages' }
    ],
    contractor: [
      { label: 'Home', href: 'contractor.html', icon: '🏠' },
      { label: 'Tools', href: 'pricing-estimator.html', icon: '🔧' },
      { label: 'Job Board', href: 'contractor-dashboard.html', icon: '📋' },
      { label: 'Messages', href: 'messages.html', icon: '💬', badge: 'messages' }
    ]
  };

  class UnifiedNavigation {
    constructor() {
      this.user = this.getUserData();
      this.notificationCount = 0;
      this.messageCount = 0;
      this.init();
    }

    getUserData() {
      const username = localStorage.getItem(STORAGE_KEYS.USERNAME);
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);

      if (!username || !token) return null;

      return { username, token, role };
    }

    async fetchNotificationCount() {
      if (!this.user) return;

      try {
        const response = await fetch(`/api/notifications/unread?email=${encodeURIComponent(this.user.username)}`);
        if (response.ok) {
          const data = await response.json();
          this.notificationCount = data.count || 0;
          this.updateNotificationBadge();
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    }

    async fetchMessageCount() {
      if (!this.user) return;

      try {
        const response = await fetch(`/api/messages/unread?email=${encodeURIComponent(this.user.username)}`);
        if (response.ok) {
          const data = await response.json();
          this.messageCount = data.count || 0;
          this.updateMessageBadge();
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    }

    updateNotificationBadge() {
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        if (this.notificationCount > 0) {
          badge.textContent = this.notificationCount > 99 ? '99+' : this.notificationCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }

    updateMessageBadge() {
      const badges = document.querySelectorAll('.nav-link[data-badge="messages"] .nav-badge');
      badges.forEach(badge => {
        if (this.messageCount > 0) {
          badge.textContent = this.messageCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      });
    }

    createNavHTML() {
      if (!this.user) return '';

      const navLinks = NAV_CONFIG[this.user.role] || [];
      const navLinksHTML = navLinks.map(link => `
        <a href="${link.href}" class="nav-link" data-badge="${link.badge || ''}">
          <span class="nav-icon">${link.icon}</span>
          <span class="nav-label">${link.label}</span>
          ${link.badge ? '<span class="nav-badge">0</span>' : ''}
        </a>
      `).join('');

      const brandHref = this.user.role === 'contractor' ? 'contractor.html' : 'home.html';

      return `
        <nav class="unified-nav">
          <div class="nav-container">
            <div class="nav-brand">
              <a href="${brandHref}" class="brand-link">
                <span class="brand-icon">🏠</span>
                <span class="brand-name">HomeProHub</span>
              </a>
            </div>

            <div class="nav-links">
              ${navLinksHTML}
            </div>

            <div class="nav-actions">
              <button class="nav-notification-btn" onclick="homeprohubNav.toggleNotifications()">
                <span class="notification-icon">🔔</span>
                <span class="notification-badge">0</span>
              </button>

              <div class="nav-profile-dropdown">
                <button class="nav-profile-btn" onclick="homeprohubNav.toggleProfileMenu()">
                  <span class="profile-avatar">${this.user.username.charAt(0).toUpperCase()}</span>
                  <span class="profile-name">${this.user.username.split('@')[0]}</span>
                  <span class="dropdown-arrow">▼</span>
                </button>

                <div class="profile-menu" id="profileMenu">
                  <div class="profile-menu-header">
                    <div class="profile-menu-email">${this.user.username}</div>
                    <div class="profile-menu-role">${this.user.role}</div>
                  </div>
                  <div class="profile-menu-divider"></div>
                  <a href="${this.user.role === 'contractor' ? 'contractor-profile.html' : 'user.profile.html'}" class="profile-menu-item">
                    <span class="menu-icon">👤</span>
                    <span>My Profile</span>
                  </a>
                  <div class="profile-menu-divider"></div>
                  <button onclick="homeprohubNav.logout()" class="profile-menu-item logout-item">
                    <span class="menu-icon">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Notifications Panel -->
          <div class="notifications-panel" id="notificationsPanel">
            <div class="notifications-header">
              <h3>Notifications</h3>
              <button onclick="homeprohubNav.markAllAsRead()" class="mark-all-read-btn">Mark all as read</button>
            </div>
            <div class="notifications-list" id="notificationsList">
              <div class="notifications-empty">No new notifications</div>
            </div>
          </div>
        </nav>
      `;
    }

    toggleNotifications() {
      const panel = document.getElementById('notificationsPanel');
      const profileMenu = document.getElementById('profileMenu');

      if (profileMenu) profileMenu.classList.remove('show');

      if (panel) {
        panel.classList.toggle('show');
        if (panel.classList.contains('show')) {
          this.loadNotifications();
        }
      }
    }

    toggleProfileMenu() {
      const menu = document.getElementById('profileMenu');
      const panel = document.getElementById('notificationsPanel');

      if (panel) panel.classList.remove('show');

      if (menu) {
        menu.classList.toggle('show');
      }
    }

    async loadNotifications() {
      if (!this.user) return;

      const list = document.getElementById('notificationsList');
      if (!list) return;

      list.innerHTML = '<div class="notifications-loading">Loading...</div>';

      try {
        const response = await fetch(`/api/notifications?email=${encodeURIComponent(this.user.username)}&limit=10`);
        if (!response.ok) throw new Error('Failed to load notifications');

        const data = await response.json();
        const notifications = data.notifications || [];

        if (notifications.length === 0) {
          list.innerHTML = '<div class="notifications-empty">No new notifications</div>';
          return;
        }

        list.innerHTML = notifications.map(notif => `
          <div class="notification-item ${notif.read ? 'read' : 'unread'}" data-id="${notif.id}">
            <div class="notification-icon">${this.getNotificationIcon(notif.notification_type)}</div>
            <div class="notification-content">
              <div class="notification-title">${notif.title}</div>
              <div class="notification-message">${notif.message}</div>
              <div class="notification-time">${this.formatTime(notif.created_at)}</div>
            </div>
            ${!notif.read ? `<button onclick="homeprohubNav.markAsRead('${notif.id}')" class="mark-read-btn">✓</button>` : ''}
          </div>
        `).join('');
      } catch (error) {
        console.error('Error loading notifications:', error);
        list.innerHTML = '<div class="notifications-error">Failed to load notifications</div>';
      }
    }

    getNotificationIcon(type) {
      const icons = {
        'new_job': '💼',
        'new_bid': '📝',
        'bid_accepted': '✅',
        'bid_rejected': '❌',
        'new_message': '💬',
        'rating_received': '⭐',
        'job_completed': '🎉'
      };
      return icons[type] || '📬';
    }

    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    }

    async markAsRead(notificationId) {
      try {
        await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        this.notificationCount = Math.max(0, this.notificationCount - 1);
        this.updateNotificationBadge();
        this.loadNotifications();
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    async markAllAsRead() {
      try {
        await fetch(`/api/notifications/mark-all-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.user.username })
        });

        this.notificationCount = 0;
        this.updateNotificationBadge();
        this.loadNotifications();
      } catch (error) {
        console.error('Error marking all as read:', error);
      }
    }

    logout() {
      try {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem('homeprohub_profile_complete');
      } catch (e) {
        console.error('Error during logout:', e);
      }
      window.location.href = 'index.html';
    }

    init() {
      // Inject navigation HTML
      const navHTML = this.createNavHTML();
      if (navHTML) {
        // Insert at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', navHTML);

        // Fetch initial counts
        this.fetchNotificationCount();
        this.fetchMessageCount();

        // Poll for updates every 30 seconds
        setInterval(() => {
          this.fetchNotificationCount();
          this.fetchMessageCount();
        }, 30000);

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.nav-profile-dropdown') && !e.target.closest('.nav-notification-btn')) {
            const menu = document.getElementById('profileMenu');
            const panel = document.getElementById('notificationsPanel');
            if (menu) menu.classList.remove('show');
            if (panel) panel.classList.remove('show');
          }
        });
      }
    }
  }

  // Initialize navigation when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.homeprohubNav = new UnifiedNavigation();
    });
  } else {
    window.homeprohubNav = new UnifiedNavigation();
  }
})();
