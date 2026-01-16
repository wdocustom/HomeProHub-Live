# Kitchen Remodel Workflow - Plumbing Contractor Example

This document demonstrates how a plumbing contractor would use the HomeProHub Command Center to manage a kitchen remodel project from start to finish.

## Project Overview
- **Project Type:** Kitchen Remodel
- **Client:** Sarah Johnson (123 Main St, Omaha, NE 68105)
- **Scope:** Complete kitchen plumbing renovation including:
  - New kitchen sink and faucet installation
  - Dishwasher rough-in and connection
  - Under-sink water filtration system
  - Gas line for new range
  - Floor drain relocation

## Phase 1: Project Setup (Project Estimator)

### Step 1: Create Estimate
1. Navigate to **AI Command Center → Project Estimator**
2. Set trade type to **"Plumber"**
3. Enter project details:
   - **Job Description:** "Complete kitchen plumbing renovation - new sink, dishwasher, gas line, and filtration system"
   - **ZIP Code:** 68105
   - **Finish Level:** Premium (high-end fixtures)
   - **Number of Fixtures:** 4 (sink, dishwasher, filter system, gas range)
   - **Pipe Material:** PEX
   - **Slab Work:** No

### Step 2: Review AI-Generated Estimate
The system generates:
- **Estimate Range:** $4,500 - $7,200
- **Breakdown:**
  - Labor: $2,800 - $4,000
  - Materials: $1,200 - $2,200
  - Permits & Inspection: $500 - $1,000
- **Timeline:** 3-4 days

### Step 3: Save Project to Command Center
Click **"Save to AI Command Center"** to activate the AI agents.

---

## Phase 2: Procurement (The Hawk Agent - Trade-Specific)

### What Makes This Different for Plumbers?
Unlike general contractors who need to find subcontractors, plumbers ARE the subcontractor. The Hawk agent for plumbers focuses on:
- **Material Suppliers** (not subcontractors)
- **Inspection Services**
- **Specialty Equipment Vendors**

### Step 4: Auto-Scout Suppliers & Inspectors
1. The Hawk agent automatically activates with:
   - **Description:** "Finds plumbing suppliers, schedules inspections, and sources fixtures & materials for your projects."
   - **Button:** "Auto-Scout Suppliers & Inspectors" (not "Auto-Scout Subcontractors")

2. Click **"Auto-Scout Suppliers & Inspectors"**

3. System returns:
   ```
   ✅ Found 3 Verified Suppliers & Inspectors
   Serving 68105 area

   1. Ferguson Plumbing Supply
      ⭐ 4.8 | 📍 2.1mi | Same-Day Delivery

   2. Home Depot PRO
      ⭐ 4.7 | 📍 4.3mi | Trade Accounts

   3. City Plumbing Inspectors
      ⭐ 5.0 | 📍 Service Area | Licensed Inspector
   ```

### Step 5: Request Quotes
Click **"Request Quotes"** to send project specs to suppliers for material pricing.

---

## Phase 3: Project Execution (The Summarizer Agent)

### Step 6: Daily Progress Updates
The Summarizer agent automatically generates friendly updates for the homeowner:

**Day 1 Update:**
> "Hi Sarah! Great progress today on your kitchen remodel. We've completed the rough-in work for your new sink and dishwasher. The water lines are installed and pressure tested - everything looks perfect! Tomorrow we'll be installing the gas line for your new range. Everything is on schedule!"

**Day 2 Update:**
> "Sarah, we're making excellent headway! The gas line installation is complete and passed our safety inspection. We also installed your under-sink water filtration system. Next up: final fixture installation. Your new kitchen plumbing is really coming together!"

**Day 3 Update:**
> "Final day of work is going great! We've installed your beautiful new kitchen sink and faucet, and connected the dishwasher. The inspector will be here tomorrow morning for the final sign-off. You're going to love your upgraded kitchen!"

---

## Phase 4: Inspection & Completion (The Hawk Agent - Inspector Coordination)

### Step 7: Schedule Final Inspection
The Hawk agent helps coordinate with the inspector:
- **Inspector:** City Plumbing Inspectors
- **Date:** Next available appointment
- **Items to Inspect:**
  - Gas line installation and leak test
  - Water supply connections
  - Drain/waste/vent (DWV) system
  - Fixture installations

### Step 8: Inspection Results
✅ **PASSED** - All work meets code requirements

---

## Phase 5: Future Features (Coming Soon)

### The Orchestrator Agent
Will manage project phases and dependencies:
- Track which tasks must be completed before others
- Coordinate with other trades (if working alongside GC)
- Manage timeline adjustments

### The Whip Agent
Will handle scheduling:
- Coordinate inspection appointments
- Reschedule work based on material delivery delays
- Update homeowner on timeline changes

---

## Key Differences: Plumber vs. General Contractor

| Feature | General Contractor | Plumbing Contractor |
|---------|-------------------|---------------------|
| **Hawk Agent Description** | "Finds and coordinates subcontractors" | "Finds plumbing suppliers, schedules inspections, and sources fixtures" |
| **Hawk Agent Icon** | 👥 (users/team) | 📦 (box/supplies) |
| **Auto-Scout Button** | "Auto-Scout Subcontractors" | "Auto-Scout Suppliers & Inspectors" |
| **Results Show** | Local subcontractors (electricians, plumbers, HVAC) | Material suppliers, inspectors, specialty vendors |
| **Call-to-Action** | "Invite All to Bid" | "Request Quotes" |
| **Primary Need** | Finding reliable trade workers | Finding reliable suppliers and booking inspections |

---

## Summary

This trade-specific approach ensures that:
1. **Plumbers** see tools relevant to their business (suppliers, not subs)
2. **The AI agents** provide contextually appropriate assistance
3. **The workflow** matches how plumbers actually work
4. **The terminology** aligns with industry standards

The same trade-specific customization applies to:
- **Electricians** → Electrical suppliers and inspection coordinators
- **HVAC Technicians** → HVAC distributors and equipment vendors
- **General Contractors** → Subcontractor coordination and bid management

---

## Technical Implementation

The system automatically detects the user's trade type and adapts:

```javascript
// When user selects "Plumber" from trade selector
updateHawkAgentForTrade('plumber');

// Result:
// - Description changes to supplier-focused
// - Button text updates to "Auto-Scout Suppliers & Inspectors"
// - Icon changes to package/box icon
// - Results show suppliers instead of subcontractors
```

This ensures every contractor sees a Command Center tailored to their specific trade needs!
