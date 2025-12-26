/**
 * HomeProHub Authentication Service
 * Handles all authentication using Supabase Auth
 * Replaces localStorage-based auth with proper server-side sessions
 */

// Note: This expects @supabase/supabase-js to be loaded via CDN in the HTML
// Add this to your HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

class AuthService {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.initialized = false;
  }

  /**
   * Initialize Supabase client
   * Call this once when the page loads
   */
  async init() {
    if (this.initialized) return;

    try {
      // Get Supabase config from server
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to get Supabase config');
      }

      const config = await response.json();

      // Initialize Supabase client
      this.supabase = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

      // Get current session
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.currentUser = session.user;
      }

      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        this.currentUser = session?.user || null;

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          this.handleSignOut();
        }
      });

      this.initialized = true;
      console.log('✓ AuthService initialized');
    } catch (error) {
      console.error('Failed to initialize AuthService:', error);
      throw error;
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: userData.role || 'homeowner',
            full_name: userData.full_name,
            business_name: userData.business_name,
            phone: userData.phone
          }
        }
      });

      if (error) throw error;

      // Create user profile in database
      if (data.user) {
        await this.createUserProfile(data.user, userData);
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentUser = data.user;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    if (this.currentUser) return this.currentUser;

    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const session = await this.getSession();
    return !!session;
  }

  /**
   * Get user role from profile
   */
  async getUserRole() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    try {
      const response = await fetch(`/api/user/profile?email=${encodeURIComponent(user.email)}`);
      if (!response.ok) return null;

      const profile = await response.json();
      return profile.role;
    } catch (error) {
      console.error('Get role error:', error);
      return null;
    }
  }

  /**
   * Require authentication (redirect if not authenticated)
   */
  async requireAuth(redirectTo = '/index.html') {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  /**
   * Require specific role
   */
  async requireRole(role, redirectTo = '/index.html') {
    const authenticated = await this.requireAuth(redirectTo);
    if (!authenticated) return false;

    const userRole = await this.getUserRole();
    if (userRole !== role) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  /**
   * Create user profile in database
   */
  async createUserProfile(user, userData) {
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          role: userData.role || 'homeowner',
          full_name: userData.full_name,
          first_name: userData.first_name,
          last_name: userData.last_name,
          business_name: userData.business_name,
          company_name: userData.company_name,
          phone: userData.phone,
          profile_complete: false
        })
      });
    } catch (error) {
      console.error('Create profile error:', error);
    }
  }

  /**
   * Handle sign out (cleanup)
   */
  handleSignOut() {
    // Clear any local state
    this.currentUser = null;

    // Redirect to home
    if (window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('/')) {
      window.location.href = '/index.html';
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update password error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const authService = new AuthService();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => authService.init());
} else {
  authService.init();
}

// Export for use in other scripts
window.authService = authService;
