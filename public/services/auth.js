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
      // Use backend endpoint for signup (handles both auth and profile creation)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role: userData.role || 'homeowner',
          full_name: userData.full_name,
          phone: userData.phone,
          company_name: userData.company_name || userData.business_name,
          address: userData.address,
          city: userData.city,
          state: userData.state,
          zip_code: userData.zip_code
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Update local state
      this.currentUser = data.user;

      // Set session in Supabase client
      if (data.session && this.supabase) {
        await this.supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
      }

      return { success: true, user: data.user, session: data.session };
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
      // Use backend endpoint for signin
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sign in failed');
      }

      // Update local state
      this.currentUser = data.user;

      // Set session in Supabase client
      if (data.session && this.supabase) {
        await this.supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
      }

      return { success: true, user: data.user, profile: data.profile };
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
      // Call backend signout endpoint if we have a token
      const token = await this.getAccessToken();
      if (token) {
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      // Also sign out from Supabase client
      if (this.supabase) {
        await this.supabase.auth.signOut();
      }

      this.currentUser = null;
      this.handleSignOut();

      // Redirect to landing page after sign out
      window.location.href = 'index.html';

      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, clear local state and redirect
      this.currentUser = null;
      this.handleSignOut();
      window.location.href = 'index.html';
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
   * Get access token for API requests
   */
  async getAccessToken() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

  /**
   * Make authenticated API request
   * Automatically adds Authorization header with JWT token
   */
  async authenticatedFetch(url, options = {}) {
    const token = await this.getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    return fetch(url, { ...options, headers });
  }

  /**
   * Get user profile from backend
   */
  async getUserProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    try {
      const response = await this.authenticatedFetch('/api/auth/user');
      if (!response.ok) return null;

      const data = await response.json();
      return data.profile;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  /**
   * Get user role from profile
   */
  async getUserRole() {
    const profile = await this.getUserProfile();
    return profile?.role || null;
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

    // Note: Navigation component (navigation.js) handles redirects
    // We don't redirect here to avoid race conditions with page auth checks
    console.log('User signed out - navigation will handle redirect');
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
