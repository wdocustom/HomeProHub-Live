# HomeProHub Application Architecture

## Synchronous Boot Sequence

This application uses a **centralized initialization system** to eliminate race conditions and ensure predictable loading.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Loads Page                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Load Dependencies (Passive)                         │
│  - auth.js (passive service, no auto-init)                   │
│  - unified-navigation.js (passive service, no auto-init)     │
│  - Other components                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: AppController Initializes (BLOCKING SEQUENCE)       │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. AUTHENTICATE USER (Blocking)                        │  │
│  │    - Wait for AuthService                              │  │
│  │    - Call authService.init()                           │  │
│  │    - Set window.currentUser                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. DETERMINE GLOBAL STATE (Blocking)                   │  │
│  │    - Detect user role                                  │  │
│  │    - Detect current zone                               │  │
│  │    - Create window.appState                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. RENDER CORE UI (Blocking)                           │  │
│  │    - Wait for SanctuaryNavigation                      │  │
│  │    - Call SanctuaryNavigation.init(zone)               │  │
│  │    - Render header + navigation                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 4. HYDRATE PAGE CONTENT                                │  │
│  │    - Dispatch 'app-ready' event                        │  │
│  │    - Page-specific initialization runs                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    ✅ App Ready
```

## Key Principles

### 1. Passive Services
All services (`auth.js`, `unified-navigation.js`) are **passive**:
- They export their functionality to `window.*`
- They DO NOT auto-initialize
- They wait for the AppController to call them

### 2. Explicit Initialization
The `app-controller.js` orchestrates everything:
- Enforces strict boot order
- Uses `await` instead of `setTimeout` hacks
- Shows loading state during boot
- Handles errors gracefully

### 3. Global State
- `window.currentUser` - Set by auth.js (null for guest, user object when logged in)
- `window.appState` - Set by app-controller.js with full app state
- `window.authService` - Passive auth service
- `window.SanctuaryNavigation` - Passive navigation service

### 4. Event-Driven Hydration
After core initialization, the AppController dispatches `app-ready`:
```javascript
window.addEventListener('app-ready', (e) => {
  const { user, userState, role, zone } = e.detail;
  // Your page-specific initialization
});
```

## File Structure

```
public/
├── services/
│   ├── auth.js              # Passive auth service
│   └── app-controller.js    # Central orchestrator
├── components/
│   └── unified-navigation.js # Passive navigation service
└── pages/
    └── home.html            # Loads app-controller.js last
```

## Migration Guide

### Before (Race Condition):
```html
<!-- auth.js auto-initializes -->
<script src="/services/auth.js"></script>

<!-- navigation.js waits for 'auth-ready' event -->
<script src="/components/unified-navigation.js"></script>

<!-- Manual initialization (timing issues) -->
<script>
  window.SanctuaryNavigation.init('C');
</script>
```

### After (Synchronized):
```html
<!-- Passive service (no auto-init) -->
<script src="/services/auth.js"></script>

<!-- Passive service (no auto-init) -->
<script src="/components/unified-navigation.js"></script>

<!-- Orchestrator (MUST BE LAST) -->
<script src="/services/app-controller.js"></script>
```

## Benefits

✅ **No Race Conditions** - Strict boot order
✅ **No setTimeout Hacks** - Uses await patterns
✅ **Predictable Loading** - Same flow every time
✅ **Loading States** - User sees progress
✅ **Error Handling** - Graceful failures
✅ **Single Source of Truth** - window.appState

## Debugging

Enable verbose logging:
```javascript
// In console
localStorage.setItem('debug', 'true');
location.reload();
```

Boot sequence logs:
```
🚀 [AppController] Starting application initialization...
🔐 [AppController] Step 1: Authenticating user...
✓ [AppController] Step 1 Complete. User State: homeowner
🎯 [AppController] Step 2: Determining global state...
✓ [AppController] Step 2 Complete. App State: {...}
🎨 [AppController] Step 3: Rendering core UI...
✓ [AppController] Step 3 Complete. Core UI rendered.
📦 [AppController] Step 4: Hydrating page content...
✓ [AppController] Step 4 Complete. Page hydration triggered.
✅ [AppController] Application initialization complete!
```

## Rollout Plan

### Phase 1: Core Pages (CURRENT)
- ✅ home.html
- ⏳ contractor-dashboard.html
- ⏳ signin.html
- ⏳ signup.html

### Phase 2: Dashboard Pages
- All homeowner pages
- All contractor pages

### Phase 3: Public Pages
- index.html
- for-homeowners.html
- for-contractors.html

### Phase 4: Legacy Cleanup
- Remove old event listeners
- Remove setTimeout hacks
- Update documentation
