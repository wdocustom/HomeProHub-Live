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
    this.initPromise = null;  // Track ongoing initialization
  }

  /**
   * Initialize Supabase client
   * Call this once when the page loads
   */
  async init() {
    // Prevent multiple simultaneous init() calls (race condition fix)
    if (this.initialized) {
      return;
    }

    // If initialization is already in progress, wait for it to complete
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create and store the initialization promise
    this.initPromise = this._doInit();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async _doInit() {
    try {
      // PART 1: Handle Supabase errors in URL hash (e.g., otp_expired from cross-device verification)
      this.handleURLErrors();

      // Get Supabase config from server
      const response = await fetch('/api/config');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'AUTH_NOT_CONFIGURED') {
          console.warn('⚠️ Supabase credentials not configured. Authentication features disabled.');
          throw new Error('AUTH_NOT_CONFIGURED');
        }
        throw new Error('Failed to get Supabase config');
      }

      const config = await response.json();

      // Validate that credentials are not placeholders
      const isPlaceholder =
        !config.supabaseUrl ||
        !config.supabaseAnonKey ||
        config.supabaseUrl.includes('your-project.supabase.co') ||
        config.supabaseAnonKey.includes('your-supabase-anon-key');

      if (isPlaceholder) {
        console.warn('⚠️ Supabase credentials are placeholder values. Please configure real credentials in .env file.');
        console.warn('   Visit https://supabase.com to create a project and get your credentials.');
        throw new Error('PLACEHOLDER_CREDENTIALS');
      }

      // Initialize Supabase client (wrap in try-catch to handle AbortError)
      try {
        this.supabase = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      } catch (clientError) {
        // Handle client creation errors (including AbortError)
        if (clientError.name === 'AbortError') {
          console.warn('⚠️ Supabase client creation aborted (likely page navigation)');
          throw clientError; // Let outer handler deal with it
        }
        console.error('❌ Failed to create Supabase client:', clientError);
        throw new Error('Supabase client creation failed: ' + clientError.message);
      }

      // Get current session - trust Supabase's internal validation
      let session = null;
      try {
        const { data, error } = await this.supabase.auth.getSession();

        if (error) {
          // Suppress error messages when credentials are placeholder/invalid
          if (!error.message?.includes('aborted') && !error.message?.includes('Invalid')) {
            console.warn('⚠️ getSession() returned error:', error.message);
          }
          session = null;
        } else {
          session = data.session;
        }
      } catch (err) {
        // Suppress expected errors when Supabase is not configured
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          // This is expected when Supabase project is paused or credentials are invalid
          // Silently fail - the app will show configuration warning
        } else {
          // Log unexpected errors
          console.warn('⚠️ getSession() failed with exception:', err.message);
        }
        session = null;
      }

      // Set global user object
      if (session && session.user) {
        this.currentUser = session.user;
        window.currentUser = session.user;
      } else {
        this.currentUser = null;
        window.currentUser = null;
      }

      // PART 2: Master Auth Listener - Page Guard to prevent homepage hijacking
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        // 1. Debugging

        // CRITICAL FIX: Handle SIGNED_OUT first before any other logic
        if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.handleSignOut();
          // Don't redirect here - let the signOut method handle it
          return;
        }

        // Update current user reference
        this.currentUser = session?.user || null;

        // 2. GUEST GUARD: If no session, stop everything.
        if (!session || !session.user) {
          return;
        }

        // 3. SESSION VALIDATION: Check if this is a stale/invalid session
        // Skip validation for INITIAL_SESSION since we already validated on init
        // Skip validation for SIGNED_IN when we have fresh cached profile (from signIn)
        // Only validate for SIGNED_IN events when there's no cached profile
        if (event === 'SIGNED_IN' && !this.cachedProfile) {
          try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error) {
              // IMPORTANT: Only sign out if it's a genuine auth error, not a network error
              const isAuthError = error.status === 401 || error.message?.includes('invalid') || error.message?.includes('expired');
              if (isAuthError) {
                await this.supabase.auth.signOut();
                return;
              } else {
                // Network error or temporary issue - log but DON'T sign out
                console.warn('⚠️ Session validation encountered network error:', error.message);
              }
            } else if (!user) {
              await this.supabase.auth.signOut();
              return;
            }
          } catch (err) {
            // Network/timeout errors - don't sign the user out
            console.warn('⚠️ Session validation failed with exception:', err.message);
          }
        }

        // 4. PAGE GUARD (The Fix):
        // We only want to auto-redirect users who are actively trying to Sign In or Sign Up.
        // If they are on the Home Page (index.html), let them stay there!
        const path = window.location.pathname.replace(/\/$/, "") || "/";
        const allowedRedirectPages = ['/signin.html', '/signup.html'];
        const isAuthPage = allowedRedirectPages.some(p => path.endsWith(p));

        // CRITICAL FIX: Only redirect on explicit SIGNED_IN event, not INITIAL_SESSION
        // This prevents auto-redirect when user visits signin page with existing session
        if (!isAuthPage) {
          return;
        }

        // If user just loaded the page (INITIAL_SESSION), don't auto-redirect
        // Let them see the signin page and decide what to do
        if (event === 'INITIAL_SESSION') {
          return;
        }

        // --- FROM HERE DOWN, WE ONLY RUN FOR EXPLICIT SIGN-IN (SIGNED_IN event) ---

        // 5. Retrieve Draft Data
        const cookieDraft = this.getCookie('hot_lead_draft');
        const localDraft = localStorage.getItem('hot_lead_draft');
        const hasDraft = cookieDraft || localDraft;

        if (hasDraft) {
          // Scenario A: Finishing the Flow -> Post Project
          if (!cookieDraft && localDraft) this.setCookie('hot_lead_draft', localDraft, 1);
          window.location.href = '/post-project.html';
        } else {
          // Scenario B: Just Logging In -> Dashboard
          // CRITICAL FIX: Check user role to redirect to correct dashboard

          let role = null;

          // 1. First, check cached profile from signIn (fastest, already fetched)
          if (this.cachedProfile?.role) {
            role = this.cachedProfile.role;
          }

          // 2. If not cached, check user metadata (faster, no API call)
          if (!role) {
            role = session?.user?.user_metadata?.role || session?.user?.app_metadata?.role;
            if (role) {
            }
          }

          // 3. If still not found, fetch from profile with timeout (slowest)
          if (!role) {
            try {
              const profilePromise = this.getUserProfile();
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
              );

              const profile = await Promise.race([profilePromise, timeoutPromise]);
              role = profile?.role || 'homeowner';
            } catch (err) {
              role = 'homeowner';
            }
          }

          // 4. Fallback to homeowner if still no role
          role = role || 'homeowner';

          // 5. Clear cached profile after use
          this.cachedProfile = null;

          // 6. Redirect based on role
          if (role === 'contractor') {
            window.location.href = '/contractor-dashboard.html';
          } else {
            window.location.href = '/home.html';
          }
        }
      });

      this.initialized = true;

      // CRITICAL: Check for pending draft data after initialization
      // This handles the case where user signed in from estimator/blueprint flow
      // and was redirected to dashboard, but draft wasn't picked up
      // IMPORTANT: Only do this if we're NOT already on post-project page (prevents infinite loop!)
      const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
      const isPostProjectPage = currentPath.includes('post-project');

      if (session && session.user && !isPostProjectPage) {

        // Check for draft data (multiple possible keys)
        let draftData = localStorage.getItem('hot_lead_draft');
        const pendingEstimate = localStorage.getItem('pending_estimate');

        // If we have a pending_estimate but no hot_lead_draft, convert it
        if (!draftData && pendingEstimate) {
          localStorage.setItem('hot_lead_draft', pendingEstimate);
          localStorage.removeItem('pending_estimate');
          draftData = pendingEstimate;
        }

        if (draftData) {
          // Give a moment for the page to settle, then redirect
          setTimeout(() => {
            window.location.href = '/post-project.html';
          }, 500);
        } else {
        }
      } else if (isPostProjectPage) {
      }
    } catch (error) {
      // Handle AbortError gracefully (happens when page navigation interrupts initialization)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        // This is expected when Supabase project is paused or credentials are invalid
        // Silently handle - no need to log warnings
        this.initialized = false;

        // Show configuration warning if on auth pages
        const path = window.location.pathname;
        if (path.includes('signin') || path.includes('signup')) {
          this.showConfigurationWarning();
        }
        return; // Don't throw - allow graceful degradation
      }

      // Handle configuration errors with user-friendly messages
      if (error.message === 'AUTH_NOT_CONFIGURED' || error.message === 'PLACEHOLDER_CREDENTIALS') {
        // Silently handle configuration errors - no console spam
        this.initialized = false;

        // Show user-friendly message in UI only on auth pages
        const path = window.location.pathname;
        if (path.includes('signin') || path.includes('signup')) {
          this.showConfigurationWarning();
        }
        return; // Don't throw - allow page to load in demo mode
      }

      // For other unexpected errors, log them
      console.error('❌ Failed to initialize AuthService:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // For other errors, mark as not initialized so it can retry
      this.initialized = false;

      // Don't throw - this prevents the entire page from breaking
      // Auth features will be disabled but page will still load
      console.log('⚠️ Auth features disabled due to initialization error');
    } finally {
      // THE GREEN LIGHT: Always dispatch completion event
      window.authReady = true;
      window.dispatchEvent(new CustomEvent('auth-init-complete'));
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(email, password, userData = {}) {
    try {
      // Check if auth service is properly initialized
      if (!this.initialized || !this.supabase) {
        return {
          success: false,
          error: 'Authentication service not available. Please configure Supabase credentials in your .env file and restart the server.'
        };
      }

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
      // Check if auth service is properly initialized
      if (!this.initialized || !this.supabase) {
        return {
          success: false,
          error: 'Authentication service not available. Please configure Supabase credentials in your .env file and restart the server.'
        };
      }

      // Use backend endpoint for signin
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Backend signin error:', data);
        throw new Error(data.error || 'Sign in failed');
      }

      // Update local state
      this.currentUser = data.user;

      // CRITICAL FIX: Cache the profile so auth state change handler can access it
      // This prevents redundant API calls during redirect
      this.cachedProfile = data.profile;

      // Try to set session in Supabase client (non-blocking, optional)
      // The backend has already authenticated us, so this is just for convenience
      if (data.session && this.supabase) {
        try {
          await this.supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
        } catch (sessionError) {
          console.warn('⚠️ Could not set session in Supabase client (non-critical):', sessionError.message);
        }
      }

      return { success: true, user: data.user, profile: data.profile };
    } catch (error) {
      console.error('❌ Sign in error:', error);

      // Provide helpful error messages based on error type
      let userMessage = error.message;

      if (error.message.includes('signal is aborted') || error.message.includes('AbortError')) {
        userMessage = 'Authentication service is not configured. Please contact the administrator to set up Supabase credentials.';
      } else if (error.message.includes('not available') || error.message.includes('not configured')) {
        userMessage = error.message; // Use the error message from the check at the start of signIn
      } else if (error.message.includes('Invalid login credentials')) {
        userMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      }

      return { success: false, error: userMessage };
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

      // Redirect to sign-in page after sign out
      window.location.href = 'signin.html';

      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, clear local state and redirect
      this.currentUser = null;
      this.handleSignOut();
      window.location.href = 'signin.html';
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
          window.location.href = '/contractor-dashboard.html';
        } else {
          window.location.href = '/home.html';
        }
      } else {
      }
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
   * Show configuration warning banner when Supabase is not properly configured
   */
  showConfigurationWarning() {
    // Only show warning on pages that require auth
    const path = window.location.pathname;
    const authRequiredPages = ['/signin.html', '/signup.html'];
    const isAuthPage = authRequiredPages.some(p => path.includes(p));

    if (!isAuthPage) {
      return; // Don't show warning on public pages
    }

    // Create warning banner
    const banner = document.createElement('div');
    banner.id = 'auth-config-warning';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      color: #92400e;
      padding: 16px 24px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      border-bottom: 2px solid #f59e0b;
    `;

    banner.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto;">
        <strong>⚠️ Authentication Not Configured</strong>
        <span style="margin: 0 12px; opacity: 0.7;">|</span>
        <span>Supabase credentials are not set up. Please configure SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.</span>
        <a href="https://supabase.com" target="_blank" style="margin-left: 12px; color: #1e40af; text-decoration: underline;">Get Started →</a>
      </div>
    `;

    document.body.prepend(banner);

    // Add top padding to body to prevent content from being hidden
    document.body.style.paddingTop = banner.offsetHeight + 'px';
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
      localStorage.removeItem(key);
    });

    // 2. Clear all sessionStorage items
    sessionStorage.clear();

    // 3. Clear all cookies related to drafts and auth
    const cookiesToClear = ['hot_lead_draft', 'project_draft', 'post_intent'];
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });


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

// Create singleton instance with error handling
let authService;
try {
  authService = new AuthService();
} catch (error) {
  console.error('❌ Failed to create AuthService:', error);
  authService = null;
}

// Export for use in other scripts IMMEDIATELY (before init)
window.authService = authService;

// PASSIVE MODE: Do NOT auto-initialize
// The AppController (app-controller.js) will call authService.init() explicitly
// This eliminates race conditions by enforcing a strict boot sequence

