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
    this.cachedProfile = null;  // Cache profile from signin to avoid redundant API calls
    this.initialized = false;
  }

  /**
   * Initialize Supabase client
   * Call this once when the page loads
   */
  async init() {
    if (this.initialized) return;

    try {
      // PART 1: Handle Supabase errors in URL hash (e.g., otp_expired from cross-device verification)
      this.handleURLErrors();

      // Get Supabase config from server
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to get Supabase config');
      }

      const config = await response.json();

      // Initialize Supabase client
      this.supabase = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

      // Get current session and validate it
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        // CRITICAL FIX: Validate the session on init to catch stale sessions
        // Don't just trust localStorage - verify with the server
        try {
          const { data: { user }, error } = await this.supabase.auth.getUser();
          if (error || !user) {
            console.log('Auth Init: Stale session detected on page load. Clearing...');
            await this.supabase.auth.signOut();
            this.currentUser = null;
          } else {
            this.currentUser = session.user;
          }
        } catch (err) {
          console.log('Auth Init: Session validation failed on page load. Clearing...');
          await this.supabase.auth.signOut();
          this.currentUser = null;
        }
      }

      // PART 2: Master Auth Listener - Page Guard to prevent homepage hijacking
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        // 1. Debugging
        console.log(`Auth Debug: Event=${event}, User=${session?.user?.email || 'Guest'}`);

        // CRITICAL FIX: Handle SIGNED_OUT first before any other logic
        if (event === 'SIGNED_OUT') {
          console.log('Auth Debug: User signed out. Clearing state...');
          this.currentUser = null;
          this.handleSignOut();
          // Don't redirect here - let the signOut method handle it
          return;
        }

        // Update current user reference
        this.currentUser = session?.user || null;

        // 2. GUEST GUARD: If no session, stop everything.
        if (!session || !session.user) {
          console.log('Auth Debug: No valid session detected.');
          return;
        }

        // 3. SESSION VALIDATION: Check if this is a stale/invalid session
        // Skip validation for INITIAL_SESSION since we already validated on init
        // Skip validation for SIGNED_IN when we have fresh cached profile (from signIn)
        // Only validate for SIGNED_IN events when there's no cached profile
        if (event === 'SIGNED_IN' && !this.cachedProfile) {
          try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error || !user) {
              console.log('Auth Debug: Stale session detected. Clearing...');
              await this.supabase.auth.signOut();
              return;
            }
          } catch (err) {
            console.log('Auth Debug: Session validation failed. Clearing...');
            await this.supabase.auth.signOut();
            return;
          }
        }

        // 4. PAGE GUARD (The Fix):
        // We only want to auto-redirect users who are actively trying to Sign In or Sign Up.
        // If they are on the Home Page (index.html), let them stay there!
        const path = window.location.pathname.replace(/\/$/, "") || "/";
        const allowedRedirectPages = ['/signin.html', '/signup.html'];
        const isAuthPage = allowedRedirectPages.some(p => path.endsWith(p));

        // If we are NOT on a Login/Signup page, do nothing. Stop the "Hijack".
        if (!isAuthPage) {
          console.log("Auth Debug: User is on a content page. No redirect.");
          return;
        }

        // --- FROM HERE DOWN, WE ONLY RUN FOR USERS ON LOGIN/SIGNUP PAGES ---

        // 5. Retrieve Draft Data
        const cookieDraft = this.getCookie('hot_lead_draft');
        const localDraft = localStorage.getItem('hot_lead_draft');
        const hasDraft = cookieDraft || localDraft;

        if (hasDraft) {
          // Scenario A: Finishing the Flow -> Post Project
          console.log("Auth Debug: Draft found. Completing Handoff...");
          if (!cookieDraft && localDraft) this.setCookie('hot_lead_draft', localDraft, 1);
          window.location.href = '/post-project.html';
        } else {
          // Scenario B: Just Logging In -> Dashboard
          // CRITICAL FIX: Check user role to redirect to correct dashboard
          console.log("Auth Debug: Standard Login. Checking role...");

          let role = null;

          // 1. First, check cached profile from signIn (fastest, already fetched)
          if (this.cachedProfile?.role) {
            role = this.cachedProfile.role;
            console.log(`Auth Debug: Got role from cached profile: ${role}`);
          }

          // 2. If not cached, check user metadata (faster, no API call)
          if (!role) {
            role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role;
            if (role) {
              console.log(`Auth Debug: Got role from session metadata: ${role}`);
            }
          }

          // 3. If still not found, fetch from profile with timeout (slowest)
          if (!role) {
            try {
              console.log('Auth Debug: Role not found, fetching profile...');
              const profilePromise = this.getUserProfile();
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
              );

              const profile = await Promise.race([profilePromise, timeoutPromise]);
              role = profile?.role || 'homeowner';
              console.log(`Auth Debug: Got role from profile: ${role}`);
            } catch (err) {
              console.log('Auth Debug: Could not get profile, defaulting to homeowner:', err.message);
              role = 'homeowner';
            }
          }

          // 4. Fallback to homeowner if still no role
          role = role || 'homeowner';

          // 5. Clear cached profile after use
          this.cachedProfile = null;

          // 6. Redirect based on role
          console.log(`Auth Debug: Redirecting ${role} to dashboard...`);
          if (role === 'contractor') {
            window.location.href = '/contractor.html';
          } else {
            window.location.href = '/home.html';
          }
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
          zip_code: userData.zip_code,
          // EMBEDDED METADATA STRATEGY: Pass draft project data to be saved in user metadata
          pending_project_draft: userData.pending_project_draft || null
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

      // CRITICAL FIX: Cache the profile so auth state change handler can access it
      // This prevents redundant API calls during redirect
      this.cachedProfile = data.profile;
      console.log('Auth Debug: Cached profile during signin:', data.profile?.role);

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
   * Handle URL errors from Supabase auth (e.g., otp_expired)
   * Called during init to gracefully handle cross-device verification errors
   */
  handleURLErrors() {
    // Check for Supabase errors in the URL hash (e.g., otp_expired from cross-device verification)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorCode = hashParams.get('error_code');

    if (errorCode === 'otp_expired') {
      // 1. Clean the URL so it looks professional
      window.history.replaceState(null, '', window.location.pathname);
      // 2. Alert the user (Don't leave them hanging)
      alert("Verification link expired or already used. You are likely verified! Please log in.");
      // 3. Send to Login
      window.location.href = '/signin.html';
    }
  }

  /**
   * Smart sign-in handler with infinite loop prevention
   * Handles 3 scenarios:
   * 1. "Already Verified" User: otp_expired errors handled gracefully
   * 2. "Magic Carpet" User: Redirect to draft project if exists
   * 3. "Loop of Death" Prevention: Don't redirect if already on destination page
   *
   * TASK 2: EMBEDDED METADATA STRATEGY
   * Now checks user metadata for pending draft in addition to cookies (cross-device support)
   */
  async handleSignInSmart() {
    // 1. Check Cookies (Legacy/Fallback)
    let draftProject = this.getCookie('project_draft');

    // 2. TASK 2 FIX: Check localStorage (Landing page saves here!)
    if (!draftProject) {
      const localDraft = localStorage.getItem('hot_lead_draft');
      if (localDraft) {
        console.log("✓ Found draft in localStorage!");
        draftProject = localDraft;
        // Sync to cookie for consistency across pages
        this.setCookie('project_draft', localDraft, 1);
      }
    }

    // 3. Check User Metadata (Cross-Device Cloud Save)
    if (!draftProject) {
      const user = await this.getCurrentUser();
      const metaDraft = user?.user_metadata?.pending_project_draft;

      // If we found a draft in the cloud but not locally, use the cloud one
      if (metaDraft) {
        console.log("✓ Found cloud draft! Restoring from user metadata...");
        // Re-save to cookie/localStorage so post-project.html can read it easily
        this.setCookie('project_draft', JSON.stringify(metaDraft), 1);
        localStorage.setItem('hot_lead_draft', JSON.stringify(metaDraft));
        draftProject = metaDraft;
      }
    }

    // NORMALIZATION: Remove trailing slashes to prevent matching errors
    const currentPath = window.location.pathname.replace(/\/$/, "");

    // 3. Execute the Magic Carpet Redirect
    if (draftProject) {
      // Scenario A: User has a draft (The Magic Carpet)
      // Fix: Only redirect if NOT already on the post-project page
      if (!currentPath.includes('post-project')) {
        console.log("✓ Draft found! Redirecting to project creation...");
        // Ensure draft is in localStorage for post-project.html to read
        if (typeof draftProject === 'string') {
          localStorage.setItem('hot_lead_draft', draftProject);
        } else {
          localStorage.setItem('hot_lead_draft', JSON.stringify(draftProject));
        }
        window.location.href = '/post-project.html';
      }
    } else {
      // Scenario B: Standard Login (No draft)
      // CRITICAL FIX: STOP LOOPING.
      // Only redirect if the user is currently on a "Public" page (Login, Signup, Landing).
      // If they are already on '/homeowner-dashboard.html' or '/home.html', DO NOT REDIRECT.
      const publicPages = ['/index.html', '/signin.html', '/signup.html', '/'];
      const isPublicPage = publicPages.some(page =>
        currentPath === page || currentPath === '' || currentPath === '/'
      );

      if (isPublicPage) {
        // Get user role to determine destination
        const profile = await this.getUserProfile();
        const role = profile?.role || 'homeowner';

        console.log(`No draft project - redirecting ${role} to dashboard`);

        if (role === 'contractor') {
          window.location.href = '/contractor.html';
        } else {
          window.location.href = '/home.html';
        }
      } else {
        console.log('Already on dashboard - skipping redirect to prevent loop');
      }
    }
  }

  /**
   * DEPRECATED: Old handleSignIn method - replaced by handleSignInSmart
   * Kept for reference only
   */
  async handleSignIn() {
    console.log('🔐 User signed in - checking for draft project...');

    // Check for the "Hot Potato" Cookie
    const projectDraftCookie = this.getCookie('project_draft');
    const postIntentCookie = this.getCookie('post_intent');

    if (projectDraftCookie && postIntentCookie === 'post_project') {
      console.log('✓ Found draft project cookie - redirecting to post-project.html');

      // Restore to localStorage for post-project.html to read
      localStorage.setItem('hot_lead_draft', decodeURIComponent(projectDraftCookie));

      // Redirect to post-project page
      window.location.href = 'post-project.html';
      return;
    }

    // No draft project - redirect to appropriate dashboard based on role
    const profile = await this.getUserProfile();
    const role = profile?.role || 'homeowner';

    console.log(`No draft project found - redirecting to ${role} dashboard`);

    if (role === 'contractor') {
      window.location.href = 'contractor.html';
    } else {
      window.location.href = 'home.html';
    }
  }

  /**
   * Get cookie value by name
   */
  getCookie(name) {
    const cookies = document.cookie.split(';');
    const cookie = cookies.find(c => c.trim().startsWith(`${name}=`));

    if (cookie) {
      return cookie.split('=')[1];
    }

    return null;
  }

  /**
   * Set cookie with expiration in days
   */
  setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value}; ${expires}; path=/`;
  }

  /**
   * Handle sign out (cleanup)
   * Aggressively clears all auth-related storage to prevent stale sessions
   */
  handleSignOut() {
    // Clear any local state
    this.currentUser = null;
    this.cachedProfile = null;

    // CRITICAL FIX: Aggressively clear all auth-related storage
    // This prevents stale sessions from persisting after logout

    // 1. Clear all localStorage items that might contain auth data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Remove Supabase auth keys and draft data
      if (key && (key.startsWith('supabase.auth') || key.includes('draft') || key.includes('project'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      console.log(`Clearing localStorage key: ${key}`);
      localStorage.removeItem(key);
    });

    // 2. Clear all sessionStorage items
    sessionStorage.clear();

    // 3. Clear all cookies related to drafts and auth
    const cookiesToClear = ['hot_lead_draft', 'project_draft', 'post_intent'];
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      console.log(`Cleared cookie: ${cookieName}`);
    });

    console.log('✓ All auth storage cleared - user signed out');

    // Note: Navigation component (navigation.js) handles redirects
    // We don't redirect here to avoid race conditions with page auth checks
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
