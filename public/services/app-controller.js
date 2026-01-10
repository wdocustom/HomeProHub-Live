/**
 * HomeProHub Application Controller
 * Central orchestration point for app initialization
 * Eliminates race conditions by enforcing strict boot sequence
 */

(async function initializeApp() {
  console.log('🚀 [AppController] Starting application initialization...');

  // Show loading state
  showLoadingState();

  try {
    // ============================================
    // STEP 1: AUTHENTICATE USER (BLOCKING)
    // ============================================
    console.log('🔐 [AppController] Step 1: Authenticating user...');

    // Wait for AuthService to be available
    await waitForAuthService();

    // Initialize auth and wait for completion
    await window.authService.init();

    const user = window.currentUser;
    const userState = determineUserState(user);

    console.log(`✓ [AppController] Step 1 Complete. User State: ${userState}`);

    // ============================================
    // STEP 2: DETERMINE GLOBAL STATE (BLOCKING)
    // ============================================
    console.log('🎯 [AppController] Step 2: Determining global state...');

    const appState = {
      user: user,
      userState: userState,
      role: user?.user_metadata?.role || user?.app_metadata?.role || 'guest',
      zone: detectZone(),
      timestamp: Date.now()
    };

    // Store globally for other components
    window.appState = appState;

    console.log('✓ [AppController] Step 2 Complete. App State:', {
      userState: appState.userState,
      role: appState.role,
      zone: appState.zone
    });

    // ============================================
    // STEP 3: RENDER CORE UI (BLOCKING)
    // ============================================
    console.log('🎨 [AppController] Step 3: Rendering core UI...');

    // Wait for navigation system to be available
    await waitForNavigationSystem();

    // Initialize navigation (this will render header/nav)
    if (window.SanctuaryNavigation && window.SanctuaryNavigation.init) {
      await window.SanctuaryNavigation.init(appState.zone);
    }

    console.log('✓ [AppController] Step 3 Complete. Core UI rendered.');

    // ============================================
    // STEP 4: HYDRATE PAGE CONTENT
    // ============================================
    console.log('📦 [AppController] Step 4: Hydrating page content...');

    // Dispatch event for page-specific initialization
    window.dispatchEvent(new CustomEvent('app-ready', {
      detail: appState
    }));

    console.log('✓ [AppController] Step 4 Complete. Page hydration triggered.');

    // Hide loading state
    hideLoadingState();

    console.log('✅ [AppController] Application initialization complete!');
    console.log('📊 [AppController] Total boot time:', Date.now() - performance.timing.navigationStart, 'ms');

  } catch (error) {
    console.error('❌ [AppController] Initialization failed:', error);
    handleInitializationError(error);
  }
})();

/**
 * Wait for AuthService to be loaded
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
 * Wait for Navigation System to be loaded
 */
function waitForNavigationSystem() {
  return new Promise((resolve) => {
    if (window.SanctuaryNavigation) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.SanctuaryNavigation) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ [AppController] Navigation System load timeout');
        resolve();
      }, 5000);
    }
  });
}

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
 */
function detectZone() {
  const zoneMeta = document.querySelector('meta[name="sanctuary-zone"]');
  if (zoneMeta) return zoneMeta.content;

  // Fallback: detect from path
  const path = window.location.pathname;

  if (path.includes('contractor-dashboard') || path.includes('job-board')) return 'D';
  if (path.includes('home.html') || path.includes('homeowner')) return 'C';
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
  hideLoadingState();

  // Show error message
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 32px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    text-align: center;
    z-index: 10000;
  `;

  errorDiv.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Initialization Error</h2>
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">We encountered an error loading the application.</p>
    <button onclick="location.reload()" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer;">
      Reload Page
    </button>
  `;

  document.body.appendChild(errorDiv);
}

console.log('✓ [AppController] Controller script loaded');
