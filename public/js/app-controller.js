/**
 * HomeProHub Application Controller
 * The Single Source of Truth for App Initialization
 * Loads dependencies dynamically to ensure strict execution order.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

(async function initializeApp() {
  // 1. Immediate Visual Feedback (Anti-Flicker)
  // We ensure the body exists before trying to style it
  if (document.body) document.body.style.opacity = '0';

  try {
    console.group("🚀 [AppController] Boot Sequence");

    // ============================================
    // STEP 1: LOAD DEPENDENCIES (BLOCKING)
    // ============================================
    console.time("Dependency Load");
    
    // Check if Supabase is ready
    if (!window.supabase) {
        // Fallback: If CDN failed, we could handle it here, 
        // but typically the HTML script tag handles this.
        console.log("...Waiting for Supabase SDK...");
    }

    // Load Auth Service & Navigation Service dynamically
    // This replaces the need for <script> tags in the HTML
    await Promise.all([
        loadScript('/services/auth.js'), 
        loadScript('/components/unified-navigation.js') 
    ]);
    console.timeEnd("Dependency Load");

    // ============================================
    // STEP 2: AUTHENTICATE USER (BLOCKING)
    // ============================================
    console.time("Auth Init");
    
    // Safety check: Did auth.js load correctly?
    if (!window.authService) throw new Error("AuthService failed to load");
    
    // Initialize Auth
    await window.authService.init();
    const user = window.currentUser;
    console.timeEnd("Auth Init");

    // ============================================
    // STEP 3: DETERMINE GLOBAL STATE
    // ============================================
    const appState = {
      user: user,
      role: user?.user_metadata?.role || 'guest',
      zone: detectZone(),
      timestamp: Date.now()
    };
    window.appState = appState;
    console.log(`✅ State Determined: ${appState.role} in Zone ${appState.zone}`);

    // ============================================
    // STEP 4: RENDER UI (BLOCKING)
    // ============================================
<<<<<<< HEAD
    
    // Verify Containers Exist (Fixes the White Screen Hang)
    ensureLayoutContainers();

    // Initialize Navigation
    if (window.SanctuaryNavigation) {
        await window.SanctuaryNavigation.init(appState.zone);
=======

    // Verify Containers Exist (Fixes the White Screen Hang)
    ensureLayoutContainers();

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
        name: profile?.full_name || profile?.company_name || user.user_metadata?.full_name || user.email.split('@')[0]
      };
    }

    // Initialize Navigation (passing userData to prevent duplicate auth fetches)
    if (window.SanctuaryNavigation) {
        await window.SanctuaryNavigation.init(appState.zone, userData);
>>>>>>> 3528f074b06de08b86d1bcdfd29c829325237294
    } else {
        console.warn("⚠️ SanctuaryNavigation missing, skipping nav render");
    }

    // ============================================
    // STEP 5: REVEAL APPLICATION
    // ============================================
    
    // Dispatch Ready Event
    window.dispatchEvent(new CustomEvent('app-ready', { detail: appState }));

    // Fade In
    document.body.style.transition = 'opacity 0.3s ease-in';
    document.body.style.opacity = '1';
    
    console.groupEnd();

  } catch (error) {
    console.error('❌ [AppController] Critical Boot Failure:', error);
    // Show a user-friendly error overlay if everything breaks
    document.body.innerHTML = `
        <div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:sans-serif;text-align:center;">
            <div>
                <h1 style="font-size:24px;margin-bottom:10px;">Connection Error</h1>
                <p style="color:#666;">We couldn't load the application.</p>
                <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:5px;cursor:pointer;">Retry</button>
            </div>
        </div>
    `;
    document.body.style.opacity = '1';
  }
})();

/**
 * Helper: Dynamically load a script file
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Helper: Detect Zone based on URL or Meta Tag
 */
function detectZone() {
  const meta = document.querySelector('meta[name="sanctuary-zone"]');
  if (meta) return meta.content;
  
  const path = window.location.pathname;
  if (path.includes('contractor')) return 'D';
  if (path.includes('home.html') || path.includes('homeowner')) return 'C';
  if (path.includes('signin') || path.includes('signup')) return 'B';
  return 'A'; 
}

/**
 * Helper: Ensure Header/Nav containers exist to prevent crashes
 */
function ensureLayoutContainers() {
    if (!document.getElementById('main-header-container')) {
        console.warn("🔨 [AppController] Injecting missing header container");
        const header = document.createElement('div');
        header.id = 'main-header-container';
        header.className = 'w-full z-50 relative';
        document.body.prepend(header);
    }
    if (!document.getElementById('mobile-nav-container')) {
        const mobile = document.createElement('div');
        mobile.id = 'mobile-nav-container';
        document.body.appendChild(mobile);
    }
}
