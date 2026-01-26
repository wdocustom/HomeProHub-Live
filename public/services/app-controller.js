/**
 * HomeProHub Application Controller
 * Central orchestration point for app initialization
 * REFACTORED: Robust error handling for race conditions and navigation conflicts
 */

(async function initializeApp() {
  try {
    // ============================================
    // STEP 1: AUTHENTICATE USER FIRST (CRITICAL)
    // ============================================
    // ARCHITECTURAL FIX: Authentication MUST happen before ANY UI rendering
    // This prevents false "Logged Out" redirects when UI code crashes

    let user = null;
    let authInitialized = false;

    try {
      // Wait for AuthService to be available
      await waitForAuthService();

      // Initialize auth and wait for completion
      // This may throw AbortError if page navigation happens during init
      if (window.authService && !window.authService.initialized) {
        await window.authService.init();
      }

      user = window.currentUser;
      authInitialized = true;
      console.log('✅ [AppController] Authentication completed successfully');
    } catch (authError) {
      // Handle AbortError gracefully (happens when navigation interrupts initialization)
      if (authError.name === 'AbortError' || authError.message?.includes('aborted')) {
        console.warn('⚠️ [AppController] Auth initialization aborted (likely due to navigation)');
        // Don't show error UI - this is expected during redirect
        return; // Exit gracefully
      }

      // For other errors, log but continue with guest state
      console.warn('⚠️ [AppController] Auth initialization failed:', authError.message);
      user = null;
      authInitialized = false;
    }

    // ============================================
    // STEP 2: SHOW LOADING STATE (AFTER AUTH)
    // ============================================
    // Wrap loading spinner in try-catch to prevent crashes
    try {
      showLoadingState();
    } catch (loadingError) {
      console.warn('⚠️ [AppController] Loading state render failed:', loadingError.message);
      // Continue - loading spinner is optional
    }

    const userState = determineUserState(user);

    // ============================================
    // STEP 3: DETERMINE GLOBAL STATE
    // ============================================

    const appState = {
      user: user,
      userState: userState,
      role: user?.user_metadata?.role || user?.app_metadata?.role || 'guest',
      zone: detectZone(),
      timestamp: Date.now()
    };

    // Store globally for other components
    window.appState = appState;

    // ============================================
    // STEP 4: RENDER CORE UI (NON-BLOCKING)
    // ============================================

    // REFACTORED: Pass user data to navigation to prevent duplicate auth fetches
    try {
      // Wait for navigation system to be available (with timeout)
      await waitForNavigationSystem();

      // Prepare user data for navigation (if authenticated)
      let userData = null;
      if (user) {
        // Fetch user profile synchronously if needed
        let profile = null;
        try {
          if (window.authService && window.authService.getUserProfile) {
            profile = await window.authService.getUserProfile();
          }
        } catch (profileError) {
          console.warn('⚠️ [AppController] Profile fetch failed:', profileError.message);
        }

        userData = {
          email: user.email,
          // Priority: business_name/company_name → first+last name → email
          name: profile?.business_name ||
                profile?.company_name ||
                user.user_metadata?.company_name ||
                (profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : null) ||
                profile?.full_name ||
                user.user_metadata?.full_name ||
                user.email.split('@')[0]
        };
      }

      // Initialize navigation (passing userData to prevent duplicate auth fetches)
      if (window.UnifiedNavigation && window.UnifiedNavigation.init) {
        await window.UnifiedNavigation.init(appState.zone, userData);
      } else if (window.SanctuaryNavigation && window.SanctuaryNavigation.init) {
        // Fallback for legacy navigation system
        await window.SanctuaryNavigation.init(appState.zone, userData);
      }
    } catch (navError) {
      // Navigation errors should not crash the app
      console.warn('⚠️ [AppController] Navigation system initialization failed:', navError.message);
      // Continue - page will still be functional
    }

    // ============================================
    // STEP 5: HYDRATE PAGE CONTENT
    // ============================================

    // Dispatch event for page-specific initialization
    window.dispatchEvent(new CustomEvent('app-ready', {
      detail: appState
    }));

    // Hide loading state
    hideLoadingState();

  } catch (error) {
    console.error('❌ [AppController] Fatal error during initialization:', error);
    hideLoadingState();
  }
})();

/**
 * REFACTORED: Support both UnifiedNavigation and legacy SanctuaryNavigation
 */
function waitForNavigationSystem() {
  return new Promise((resolve) => {
    // Check for modern navigation system first
    if (window.UnifiedNavigation || window.SanctuaryNavigation) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.UnifiedNavigation || window.SanctuaryNavigation) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 2 seconds (reduced from 5s for faster page load)
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ [AppController] Navigation System load timeout - continuing without navigation');
        resolve(); // Continue anyway - navigation is optional
      }, 2000);
    }
  });
}

/**
 * Wait for AuthService to be available
 * REFACTORED: Added timeout to prevent infinite waiting
 */
function waitForAuthService() {
  return new Promise((resolve) => {
    if (window.authService) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.authService) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ [AppController] AuthService load timeout');
        resolve();
      }, 5000);
    }
  });
}

/**
 * Global waitForAuth() helper
 * Waits for auth to be ready and returns the current user
 * Usage: await app.waitForAuth();
 */
async function waitForAuth() {
  // Wait for AuthService to be available
  await waitForAuthService();

  // Wait for AuthService to be initialized
  if (window.authService && !window.authService.initialized) {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.authService.initialized) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ [waitForAuth] AuthService initialization timeout');
        resolve();
      }, 5000);
    });
  }

  // Return the current user
  return window.currentUser || null;
}

// Export globally as app.waitForAuth
window.app = window.app || {};
window.app.waitForAuth = waitForAuth;

/**
 * Patient Dashboard Guard - Fail-safe session check with retry
 * Use this on protected pages to verify authentication before redirecting
 * Returns user object if authenticated, null if not
 *
 * CRITICAL FIX: This implements the "patient" check described in the requirements
 * It actively asks Supabase for the session, waits 500ms, then tries once more
 * before redirecting. This handles network jitter and initialization delays.
 */
async function checkAuth() {
  // Wait for authService to be available
  await waitForAuthService();

  // Check if supabase client is available
  if (!window.authService || !window.authService.supabase) {
    console.warn('⚠️ [checkAuth] AuthService or Supabase client not available');
    return null;
  }

  // 1. Actively ask Supabase "Do we have a session?"
  try {
    const { data: { session } } = await window.authService.supabase.auth.getSession();

    // 2. If yes, proceed.
    if (session && session.user) {
      console.log('✅ [checkAuth] Session found on first attempt');
      return session.user;
    }

    // 3. If no, wait 500ms and try ONE more time (handle network jitter)
    console.log('⏳ [checkAuth] No session found, waiting 500ms before retry...');
    await new Promise(r => setTimeout(r, 500));

    const retry = await window.authService.supabase.auth.getSession();

    if (retry.data.session && retry.data.session.user) {
      console.log('✅ [checkAuth] Session found on retry');
      return retry.data.session.user;
    }

    // 4. ONLY redirect if absolutely sure there is no session
    console.warn('⚠️ [checkAuth] No session found after retry. User is not authenticated.');
    return null;
  } catch (error) {
    console.error('❌ [checkAuth] Error checking session:', error);
    return null;
  }
}

/**
 * Require authentication on a protected page
 * Redirects to signin page if not authenticated
 * Usage: await app.requireAuth();
 */
async function requireAuth(redirectTo = '/signin.html') {
  const user = await checkAuth();

  if (!user) {
    console.warn('⚠️ [requireAuth] User not authenticated, redirecting to:', redirectTo);
    window.location.href = redirectTo;
    return null;
  }

  return user;
}

// Export globally
window.app.checkAuth = checkAuth;
window.app.requireAuth = requireAuth;

/**
 * Determine user state from user object
 */
function determineUserState(user) {
  if (!user) return 'guest';

  const role = user.user_metadata?.role || user.app_metadata?.role || 'homeowner';
  const isPro = user.user_metadata?.subscription_tier === 'pro' ||
                user.app_metadata?.subscription_tier === 'pro';

  if (isPro) return 'pro';
  if (role === 'contractor') return 'contractor';
  if (role === 'homeowner') return 'homeowner';

  return 'user';
}

/**
 * Detect current zone from page metadata
 * FIXED: Check user role first for shared pages (like messages.html)
 */
function detectZone() {
  const path = window.location.pathname;

  // CRITICAL FIX: For shared pages, determine zone by user role first
  const sharedPages = ['messages.html', 'notifications.html'];
  const isSharedPage = sharedPages.some(page => path.includes(page));

  if (isSharedPage && window.currentUser) {
    const role = window.currentUser.user_metadata?.role || window.currentUser.app_metadata?.role;
    if (role === 'contractor') return 'D'; // Contractor zone
    if (role === 'homeowner') return 'C'; // Homeowner zone
  }

  // Check meta tag for pages with explicit zone
  const zoneMeta = document.querySelector('meta[name="sanctuary-zone"]');
  if (zoneMeta) return zoneMeta.content;

  // Fallback: detect from path
  if (path.includes('contractor-dashboard') || path.includes('job-board') || path.includes('contractor-profile')) return 'D';
  if (path.includes('homeowner')) return 'C';
  if (path.includes('signin') || path.includes('signup')) return 'B';

  return 'A'; // Public zone
}

/**
 * Show loading state
 */
function showLoadingState() {
  // Create loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'app-loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(248, 250, 252, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  `;

  overlay.innerHTML = `
    <div style="text-align: center;">
      <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;"></div>
      <p style="color: #64748b; font-size: 14px; font-weight: 500;">Loading HomeProHub...</p>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(overlay);
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const overlay = document.getElementById('app-loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => overlay.remove(), 300);
  }
}

/**
 * Handle initialization errors
 */
function handleInitializationError(error) {
  // Don't show error UI for AbortError (navigation in progress)
  if (error.name === 'AbortError' || error.message?.includes('aborted')) {
    console.warn('⚠️ [AppController] Navigation in progress - skipping error UI');
    return;
  }

  // Determine user-friendly error message
  let errorTitle = 'Initialization Error';
  let errorMessage = 'We encountered an error loading the application.';
  let showReloadButton = true;

  if (error.message?.includes('AUTH_NOT_CONFIGURED') || error.message?.includes('PLACEHOLDER_CREDENTIALS')) {
    errorTitle = 'Authentication Not Configured';
    errorMessage = 'Supabase credentials are not set up. Please contact the administrator.';
    showReloadButton = false;
  } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
    errorTitle = 'Network Error';
    errorMessage = 'Could not connect to the server. Please check your internet connection.';
  } else if (error.message?.includes('timeout')) {
    errorTitle = 'Request Timeout';
    errorMessage = 'The server is taking too long to respond. Please try again.';
  }

  // Show error message
  const errorDiv = document.createElement('div');
  errorDiv.id = 'app-error-overlay';
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 32px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    text-align: center;
    z-index: 10000;
  `;

  const reloadButtonHTML = showReloadButton
    ? `<button onclick="location.reload()" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px;">
         Reload Page
       </button>`
    : '';

  errorDiv.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">${errorTitle}</h2>
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.5;">${errorMessage}</p>
    ${reloadButtonHTML}
    <div style="margin-top: 16px; font-size: 12px; color: #94a3b8;">
      Error: ${error.message}
    </div>
  `;

  document.body.appendChild(errorDiv);
}
