# Sanctuary Glass 2.0 Implementation Guide

## Overview
This document provides step-by-step instructions for updating all HomeProHub pages to use the unified Sanctuary Glass 2.0 design system with zone-based navigation.

---

## System Architecture

### Core Files
1. **`/components/sanctuary-glass.css`** - Global design system CSS
2. **`/components/unified-navigation.js`** - Zone-based navigation system
3. **`/components/sanctuary-template.html`** - Reference template

### Navigation Zones
- **Zone A**: Public Homeowner (Guest)
- **Zone B**: Public Contractor (Guest)
- **Zone C**: Homeowner App (Logged In)
- **Zone D**: Contractor App (Logged In)

---

## Quick Start: Update Any Page in 5 Steps

### Step 1: Add Core CSS
In the `<head>` section, add:
```html
<link rel="stylesheet" href="/components/sanctuary-glass.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

### Step 2: Set Body Class
Set the appropriate zone class on the `<body>` tag:
```html
<!-- Public pages -->
<body class="zone-a public-page">  <!-- Homeowner landing -->
<body class="zone-b public-page">  <!-- Contractor landing -->

<!-- App pages -->
<body class="zone-c app-page">  <!-- Homeowner dashboard -->
<body class="zone-d app-page">  <!-- Contractor dashboard -->
```

### Step 3: Remove Old Navigation
Delete any existing navigation code:
- Remove custom header/nav HTML
- Remove `.top-nav`, `.nav-container`, `.mobile-nav` elements
- Remove custom CSS for navigation
- Leave only the main content

### Step 4: Add Navigation System
Before the closing `</body>` tag, add:
```html
<script src="/components/unified-navigation.js"></script>
<script>
  // Initialize with appropriate zone (A, B, C, or D)
  window.SanctuaryNavigation.init('A');
</script>
```

### Step 5: Apply Design System Classes
Update your content to use Sanctuary Glass 2.0 classes:

**Cards:**
```html
<div class="glass-card p-8">
  Content here
</div>
```

**Buttons:**
```html
<button class="glow-button">Primary Action</button>
<button class="glow-button-secondary">Secondary Action</button>
```

**Inputs:**
```html
<input type="text" class="floater-input" placeholder="Search...">
```

**Typography:**
```html
<h1 class="text-5xl font-extrabold text-slate-900">Heading</h1>
<p class="text-slate-500 font-medium">Body text</p>
```

---

## Page Categorization

### Zone A: Public Homeowner (Guest)

**Pages:**
- `index.html` - Main landing page
- `for-homeowners.html` - How it works
- `grading-details.html` - Verification page
- `contractor-directory.html` - Public contractor directory
- `about.html` - About us
- `help.html` - Help center
- `privacy.html` - Privacy policy
- `terms.html` - Terms of service

**Navigation:**
```javascript
window.SanctuaryNavigation.init('A');
```

**Desktop Header:**
- Logo (left)
- Links: "How it Works", "Verification", "Directory"
- Button: "Sign In" (right)

**Mobile Nav:**
- How it Works (info icon)
- Verification (certificate icon)
- Directory (users icon)
- Sign In (arrow icon)

---

### Zone B: Public Contractor (Guest)

**Pages:**
- `contractors.html` - Contractor landing page
- `for-contractors.html` - How it works for contractors
- `pricing.html` - Contractor pricing
- `subscription-plans.html` - Subscription options

**Navigation:**
```javascript
window.SanctuaryNavigation.init('B');
```

**Desktop Header:**
- Logo (left)
- Links: "For Homeowners", "For Contractors", "Verification"
- Button: "Sign In" (right)

**Mobile Nav:**
- Homeowners (home icon)
- Contractors (hammer icon)
- Verification (certificate icon)
- Sign In (arrow icon)

---

### Zone C: Homeowner App (Logged In)

**Pages:**
- `homeowner-dashboard.html` - Main dashboard
- `home.html` - Projects view
- `homeowner-profile.html` - User profile
- `home-profile.html` - Profile editor
- `messages.html` - Messaging
- `ai-check.html` - AI diagnosis
- `preview.html` - Project preview
- `post-project.html` - Post new project
- `project-check-in.html` - Progress check-in
- `proposals.html` - View proposals
- `rate-pro.html` - Rate contractor

**Navigation:**
```javascript
window.SanctuaryNavigation.init('C');
```

**Desktop Header:**
- Logo (left)
- Links: "Dashboard", "Projects", "Progress", "Messages"
- Profile Dropdown (right)

**Mobile Nav:**
- Dashboard (home icon)
- Projects (list icon)
- Progress (chart icon)
- Messages (message icon)
- Profile (user icon)

**Auth Required:** Yes - redirects to `/signin.html` if not authenticated

---

### Zone D: Contractor App (Logged In)

**Pages:**
- `contractor-dashboard.html` - Main dashboard
- `contractor-grade.html` - Performance profile
- `contractor-profile.html` - User profile
- `pricing-estimator.html` - AI pricing tool
- `takeoff.html` - Takeoff tool
- `job-board.html` - Job listings
- `messages.html` - Messaging
- `add-past-project.html` - Add past work
- `homeowner-grading-directory.html` - Job leads directory

**Navigation:**
```javascript
window.SanctuaryNavigation.init('D');
```

**Desktop Header:**
- Logo (left)
- Links: "Dashboard", "Tools", "Job Board", "Messages"
- Profile Dropdown (right)

**Mobile Nav:**
- Dashboard (home icon)
- Tools (wrench icon)
- Job Board (briefcase icon)
- Messages (message icon)
- Profile (user icon)

**Auth Required:** Yes - redirects to `/signin.html` if not authenticated

---

## Design System Reference

### Color Palette

**Canvas (Body Backgrounds):**
- Public Pages: `linear-gradient(to bottom, rgba(239, 246, 255, 0.5) 0%, rgb(248, 250, 252) 100%)`
- App Pages: `rgb(248, 250, 252)` (bg-slate-50)

**Text Colors:**
- Headings: `rgb(15, 23, 42)` (text-slate-900)
- Body: `rgb(100, 116, 139)` (text-slate-500)
- Muted: `rgb(148, 163, 184)` (text-slate-400)

**Interactive Colors:**
- Primary Blue: `rgb(37, 99, 235)` (bg-blue-600)
- Success Green: `rgb(16, 185, 129)` (bg-emerald-500)
- Danger Red: `rgb(220, 38, 38)` (bg-red-600)

**Borders:**
- Default: `rgb(226, 232, 240)` (border-slate-200)
- Light: `rgb(241, 245, 249)` (border-slate-100)

### Component Classes

**Glass Cards:**
```css
.glass-card
.glass-card-hover (adds hover effect)
```

**Buttons:**
```css
.glow-button (primary)
.glow-button-secondary (gray)
.glow-button-success (green)
```

**Inputs:**
```css
.floater-input (rounded-full with shadow)
```

**Containers:**
```css
.container (max-width: 1200px)
.container-wide (max-width: 1400px)
.container-narrow (max-width: 900px)
```

**Animations:**
```css
.fade-in
.slide-up
.scale-in
```

### Typography Scale

```html
<!-- Headings (font-extrabold, text-slate-900) -->
<h1 class="text-5xl">36px - Page titles</h1>
<h2 class="text-4xl">30px - Section titles</h2>
<h3 class="text-3xl">24px - Card titles</h3>
<h4 class="text-2xl">20px - Subsections</h4>

<!-- Body (font-medium, text-slate-500) -->
<p class="text-xl">20px - Hero subheadings</p>
<p class="text-lg">18px - Large body</p>
<p class="text-base">16px - Regular body</p>
<p class="text-sm">14px - Small text</p>
<p class="text-xs">12px - Captions</p>
```

---

## Migration Checklist

For each page, check off:

- [ ] Core CSS files added to `<head>`
- [ ] Body class set to correct zone (`zone-a`, `zone-b`, `zone-c`, `zone-d`)
- [ ] Old navigation HTML removed
- [ ] Unified navigation JavaScript added
- [ ] `SanctuaryNavigation.init()` called with correct zone
- [ ] Cards updated to use `.glass-card` class
- [ ] Buttons updated to use `.glow-button` classes
- [ ] Inputs updated to use `.floater-input` class
- [ ] Typography uses correct heading/body classes
- [ ] Mobile responsiveness tested
- [ ] Authentication flow tested (for Zones C & D)
- [ ] Profile dropdown tested (for Zones C & D)

---

## Common Migration Patterns

### Pattern 1: Replacing Old Navigation

**Before:**
```html
<nav class="top-nav">
  <div class="nav-container">
    <a href="/" class="logo">HomeProHub</a>
    <div class="nav-links">
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </div>
  </div>
</nav>
```

**After:**
```html
<!-- Navigation auto-injected by unified-navigation.js -->
<!-- Add this before </body>: -->
<script src="/components/unified-navigation.js"></script>
<script>
  window.SanctuaryNavigation.init('A');
</script>
```

### Pattern 2: Updating Cards

**Before:**
```html
<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

**After:**
```html
<div class="glass-card p-8">
  <h3 class="text-2xl font-extrabold text-slate-900 mb-4">Card Title</h3>
  <p class="text-slate-500 font-medium">Card content</p>
</div>
```

### Pattern 3: Updating Buttons

**Before:**
```html
<button style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; border: none;">
  Click Me
</button>
```

**After:**
```html
<button class="glow-button">
  Click Me
</button>
```

### Pattern 4: Updating Forms

**Before:**
```html
<input type="text" placeholder="Search" style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
```

**After:**
```html
<input type="text" placeholder="Search" class="floater-input">
```

---

## Testing Checklist

After updating a page, verify:

### Desktop (1920x1080)
- [ ] Header renders correctly
- [ ] Logo links to correct home page
- [ ] Center navigation links work
- [ ] Sign In button appears (Zones A & B)
- [ ] Profile dropdown appears (Zones C & D)
- [ ] Profile dropdown toggles on click
- [ ] Logout works correctly
- [ ] Page content is properly styled
- [ ] No layout breaks or overlaps

### Tablet (768x1024)
- [ ] Desktop header still visible
- [ ] Layout adapts gracefully
- [ ] No horizontal scrolling
- [ ] Touch interactions work

### Mobile (375x667)
- [ ] Desktop header replaced with mobile header
- [ ] Bottom navigation visible
- [ ] Active state highlights current page
- [ ] All nav icons render correctly
- [ ] Icon labels are legible (10px)
- [ ] Bottom nav doesn't overlap content
- [ ] Body has 80px bottom padding
- [ ] Safe area insets respected (iOS)

### Authentication (Zones C & D Only)
- [ ] Redirects to `/signin.html` when not logged in
- [ ] Loads correctly when authenticated
- [ ] User name/email displays in profile dropdown
- [ ] Role check prevents wrong user type access
- [ ] Logout clears session and redirects

---

## Troubleshooting

### Issue: Navigation not appearing

**Solution:**
1. Verify `/components/unified-navigation.js` is loaded
2. Check browser console for errors
3. Ensure `SanctuaryNavigation.init()` is called
4. Verify zone parameter is valid ('A', 'B', 'C', or 'D')

### Issue: Mobile nav overlapping content

**Solution:**
Add bottom padding to body:
```html
<body class="zone-a public-page pb-20 md:pb-0">
```

### Issue: Profile dropdown not working

**Solution:**
1. Ensure auth.js is loaded before unified-navigation.js
2. Check user is authenticated
3. Verify zone is C or D (only zones with profile dropdown)
4. Check console for JavaScript errors

### Issue: Wrong navigation for user role

**Solution:**
The system auto-redirects based on role:
- Homeowners attempting to access Zone D → redirected to Zone C dashboard
- Contractors attempting to access Zone C → redirected to Zone D dashboard

### Issue: Styles not applying

**Solution:**
1. Verify `/components/sanctuary-glass.css` is loaded
2. Check CSS load order (sanctuary-glass.css should be before page-specific styles)
3. Clear browser cache
4. Check for CSS conflicts with inline styles

---

## Best Practices

1. **Always use the design system classes** - Don't write custom CSS for buttons, cards, etc.
2. **Test mobile first** - Most users will be on mobile devices
3. **Respect the zone system** - Don't mix Zone A navigation with Zone C content
4. **Use semantic HTML** - `<main>`, `<section>`, `<article>`, `<nav>`
5. **Keep page-specific CSS minimal** - Let the design system do the work
6. **Use Tailwind utilities** - For spacing, sizing, and layout
7. **Test authentication flows** - Especially for Zones C & D
8. **Optimize images** - Use modern formats (WebP, AVIF)
9. **Lazy load below-the-fold content** - Improve perceived performance
10. **Add loading states** - Use `.spinner` class for async operations

---

## Phase Rollout Plan

### Phase 1: Core System (Week 1)
- [x] Create sanctuary-glass.css
- [x] Create unified-navigation.js
- [x] Create sanctuary-template.html
- [x] Write implementation guide
- [ ] Update index.html (Zone A flagship)
- [ ] Update contractor-dashboard.html (Zone D flagship)

### Phase 2: Public Pages (Week 2)
- [ ] Update all Zone A pages
- [ ] Update all Zone B pages
- [ ] Test cross-browser compatibility
- [ ] Fix any responsive issues

### Phase 3: App Pages (Week 3)
- [ ] Update all Zone C pages
- [ ] Update all Zone D pages
- [ ] Test authentication flows
- [ ] Test role-based access control

### Phase 4: Polish & Optimize (Week 4)
- [ ] Performance audit
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Browser compatibility testing
- [ ] Mobile device testing
- [ ] Final QA pass

---

## File Structure

```
/public
├── components/
│   ├── sanctuary-glass.css          (Design system)
│   ├── unified-navigation.js        (Navigation system)
│   ├── sanctuary-template.html      (Reference template)
│   └── navigation.css               (Legacy - TO BE DEPRECATED)
├── services/
│   └── auth.js                      (Authentication service)
├── index.html                       (Zone A)
├── contractors.html                 (Zone B)
├── homeowner-dashboard.html         (Zone C)
├── contractor-dashboard.html        (Zone D)
└── ... (all other pages)
```

---

## Support & Questions

For questions about implementation:
1. Refer to `/components/sanctuary-template.html` for working examples
2. Check this guide's troubleshooting section
3. Review the design system CSS comments in `sanctuary-glass.css`
4. Test in the browser with DevTools console open

---

**Document Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** Ready for Implementation
