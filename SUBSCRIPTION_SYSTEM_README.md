# 🎯 HomeProHub Subscription System

## ✅ Completed Tasks

### 1. Bug Fixes (Immediate Issues)
- ✅ **Fixed contractor.html home button redirect** - Now properly redirects to contractor.html instead of index.html
- ✅ **Implemented estimator attach-to-bid functionality** - AI estimates now auto-populate bid submission forms
- ✅ **Fixed all authentication issues** - All pages now use Supabase auth consistently

### 2. Subscription System Foundation

#### Database Schema (`database/subscriptions-schema.sql`)
Created comprehensive subscription system with:

**Tables:**
- `subscription_tiers` - Defines all available plans and features
- `user_subscriptions` - Tracks user subscription status and Stripe data
- `subscription_usage` - Monthly usage tracking (bids, calls, SMS credits, etc.)
- `lead_charges` - Pay-per-lead billing for contractors
- `subscription_events` - Audit log for subscription changes

**Helper Functions:**
- `has_feature_access(email, feature)` - Check if user has access to a feature
- `check_usage_limit(email, usage_type)` - Verify usage limits before actions
- `increment_usage(email, usage_type)` - Track usage consumption

**Seeded Tiers:**

**Homeowner Tiers:**
| Tier | Price | Features |
|------|-------|----------|
| Starter | $0/mo | Basic AI diagnosis, unlimited job posting |
| Pro | $50/mo | + SMS Expert, 2 calls/mo, 1 video call |
| Elite | $99/mo | + Full AI Owners Rep, optional human rep |

**Contractor Tiers:**
| Tier | Price | Features |
|------|-------|----------|
| Starter | $0/mo | 2 bids/month, standard listing |
| Pro | $49/mo | Unlimited bids, featured badge, estimate tool |
| Premium | $149/mo | Top placement, priority messaging, PM tools |

**Pay-Per-Lead:**
- $15-30 per lead (charged when homeowner views bid)
- After 10 leads, show upsell modal to Pro plan

#### Pricing Page UI (`public/pricing.html`)
Beautiful, responsive pricing page featuring:
- ✅ Toggle between Homeowner and Contractor pricing
- ✅ "MOST POPULAR" badge on recommended tier
- ✅ ROI text for contractor plans ("Avg Pro wins 3 jobs/mo")
- ✅ Pay-per-lead section for contractors
- ✅ FAQ section
- ✅ Auth integration - redirects to signup if not logged in
- ✅ Mobile responsive design

## 📋 Next Steps (To Complete)

### 3. Subscription API Endpoints
Create server endpoints for subscription management:

```javascript
// Needed in server.js:

// Get user's current subscription
GET /api/subscriptions/current

// Create Stripe checkout session
POST /api/subscriptions/create-checkout
Body: { tierName: 'contractor_pro' }
Returns: { checkoutUrl }

// Handle Stripe webhooks
POST /api/webhooks/stripe
Body: Stripe webhook events

// Check feature access
GET /api/subscriptions/has-access/:feature

// Check usage limits
GET /api/subscriptions/usage/:usageType

// Cancel subscription
POST /api/subscriptions/cancel

// Update subscription tier
POST /api/subscriptions/update
Body: { newTierName }
```

### 4. Feature Gating Logic
Implement checks before allowing actions:

**Before submitting bid (contractor-dashboard.html):**
```javascript
// Check if user can submit bid
const usageCheck = await window.authService.authenticatedFetch(
  '/api/subscriptions/usage/bids'
);
const { allowed, remaining } = await usageCheck.json();

if (!allowed) {
  // Show upgrade modal
  showUpgradeModal('You've used all your bids for this month!');
  return;
}

// Proceed with bid submission...
```

**Before using estimator tool:**
```javascript
// Check feature access
const accessCheck = await window.authService.authenticatedFetch(
  '/api/subscriptions/has-access/estimate_tool_access'
);
const { hasAccess } = await accessCheck.json();

if (!hasAccess) {
  showUpgradeModal('Upgrade to Pro to access the AI Estimate Tool');
  return;
}
```

**After bid submission:**
```javascript
// Increment usage counter
await window.authService.authenticatedFetch('/api/subscriptions/increment-usage', {
  method: 'POST',
  body: JSON.stringify({ usageType: 'bids', amount: 1 })
});
```

### 5. Pay-Per-Lead Tracking
Implement pay-per-lead billing when homeowner views bids:

**When homeowner opens bid details:**
```javascript
// In homeowner-dashboard.html, when viewing a bid:
async function viewBidDetails(bidId) {
  // Record that homeowner viewed this bid (triggers charge)
  await window.authService.authenticatedFetch('/api/leads/record-view', {
    method: 'POST',
    body: JSON.stringify({ bidId })
  });

  // Check if contractor should see upsell
  const contractor = bid.contractor_email;
  const leadsCheck = await fetch(`/api/leads/check-upsell/${contractor}`);
  const { shouldShowUpsell, leadsCount } = await leadsCheck.json();

  // If contractor has used 10+ pay-per-lead, suggest subscription
  if (shouldShowUpsell) {
    // Show modal to contractor next time they log in
    await window.authService.authenticatedFetch('/api/leads/trigger-upsell', {
      method: 'POST',
      body: JSON.stringify({ contractorEmail: contractor })
    });
  }
}
```

**Upsell Modal (trigger after 10 leads):**
```javascript
// In contractor-dashboard.html
async function checkForUpsellPrompt() {
  const response = await window.authService.authenticatedFetch(
    '/api/leads/should-upsell'
  );
  const { shouldShow, leadsCount, totalSpent } = await response.json();

  if (shouldShow) {
    showModal({
      title: '💡 Save Money with Pro!',
      message: `You've purchased ${leadsCount} leads for $${totalSpent}.

      Switch to Pro for just $49/month and get:
      ✅ Unlimited bids
      ✅ Featured badge
      ✅ AI Estimate tool
      ✅ Save $${Math.max(0, totalSpent - 49)} per month!`,
      primaryButton: 'Upgrade to Pro',
      secondaryButton: 'Continue Pay-Per-Lead'
    });
  }
}
```

### 6. Stripe Integration
Set up Stripe for payment processing:

**Environment Variables (.env):**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Install Stripe:**
```bash
npm install stripe
```

**Create Checkout Session:**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/subscriptions/create-checkout', requireAuth, async (req, res) => {
  const { tierName } = req.body;
  const userEmail = req.user.email;

  // Get tier details
  const tier = await db.query(
    'SELECT * FROM subscription_tiers WHERE tier_name = $1',
    [tierName]
  );

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: tier.display_name,
          description: tier.description
        },
        recurring: { interval: 'month' },
        unit_amount: Math.round(tier.price_monthly * 100) // Cents
      },
      quantity: 1
    }],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    metadata: {
      tierName,
      userEmail
    }
  });

  res.json({ checkoutUrl: session.url });
});
```

## 🔧 Installation Steps

### 1. Run the Subscription Schema in Supabase
```sql
-- Copy and paste the entire contents of database/subscriptions-schema.sql
-- into Supabase SQL Editor and run
```

### 2. Update User Profiles
The schema automatically adds these columns to `user_profiles`:
- `subscription_tier` (default: 'starter')
- `subscription_status` (default: 'active')
- `stripe_customer_id`

### 3. Test the Pricing Page
Visit: `http://yoursite.com/pricing.html`
- Toggle between homeowner and contractor views
- Click plan buttons (currently shows alerts, needs API implementation)

## 📊 Usage Examples

### Check if contractor can submit bid
```javascript
const result = await db.query(
  "SELECT check_usage_limit($1, 'bids') as usage",
  ['contractor@example.com']
);

console.log(result.usage);
// {
//   "allowed": true,
//   "unlimited": false,
//   "limit": 2,
//   "used": 1,
//   "remaining": 1,
//   "tier_name": "Starter"
// }
```

### Check if user has feature access
```javascript
const result = await db.query(
  "SELECT has_feature_access($1, 'estimate_tool_access') as has_access",
  ['contractor@example.com']
);

console.log(result.has_access); // true or false
```

### Increment usage after action
```javascript
await db.query(
  "SELECT increment_usage($1, 'bids', 1)",
  ['contractor@example.com']
);
```

## 🎨 UI Components Needed

### Upgrade Modal
Create `/public/components/upgrade-modal.html`:
```html
<div id="upgradeModal" class="modal">
  <div class="modal-content">
    <h2>Upgrade Required</h2>
    <p id="upgradeMessage"></p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="goToPricing()">View Plans</button>
      <button class="btn-secondary" onclick="closeUpgradeModal()">Cancel</button>
    </div>
  </div>
</div>
```

### Usage Widget
Show current usage in dashboards:
```html
<div class="usage-widget">
  <h3>Your Usage This Month</h3>
  <div class="usage-bar">
    <div class="usage-label">Bids</div>
    <div class="usage-progress">
      <div class="usage-fill" style="width: 50%"></div>
    </div>
    <div class="usage-text">1 / 2 used</div>
  </div>
</div>
```

## 🚀 Deployment Checklist

- [ ] Run subscriptions-schema.sql in Supabase
- [ ] Add Stripe API keys to environment
- [ ] Implement subscription API endpoints
- [ ] Add feature gates to bid submission
- [ ] Add feature gates to estimator tool
- [ ] Implement pay-per-lead view tracking
- [ ] Add upsell modal after 10 leads
- [ ] Test Stripe checkout flow
- [ ] Test Stripe webhooks
- [ ] Add usage widgets to dashboards
- [ ] Update navigation to show "Upgrade" for free users
- [ ] Create success/cancel pages for Stripe checkout

## 📁 Files Created/Modified

### Created:
- `database/subscriptions-schema.sql` - Complete subscription system schema
- `public/pricing.html` - Beautiful pricing page
- `SUBSCRIPTION_SYSTEM_README.md` - This file

### Modified:
- `public/contractor.html` - Fixed authentication, home button redirect
- `public/contractor-dashboard.html` - Auto-open bid modal with estimate
- `public/pricing-estimator.html` - Supabase auth
- `public/contractor-profile.html` - Supabase auth, license submission fix
- `public/user.profile.html` - Supabase auth
- `public/project-check-in.html` - Supabase auth

All changes pushed to branch: `claude/code-review-refactor-adPWF`
