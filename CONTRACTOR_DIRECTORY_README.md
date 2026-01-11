# 🏗️ Contractor Directory & Grading System

## Overview

Comprehensive contractor directory with intelligent grading algorithm, search/filter capabilities, and professional UI.

## ✅ Completed Components

### 1. Database Schema (`database/contractor-grading.sql`)

#### Tables Created:

**contractor_ratings** - Store homeowner reviews of contractors
- Quality, communication, timeliness, professionalism, value ratings (1-5 scale)
- Review title and text
- Verified job flag for platform-completed projects
- Indexes on contractor_email, homeowner_email, job_id

#### Functions Created:

**calculate_contractor_grade(p_contractor_email)** - Weighted grading algorithm
```sql
-- Returns JSONB with:
{
  "grade": "A+",
  "score": 92.5,
  "color": "#10b981",
  "breakdown": {
    "profile_score": 95,
    "license_score": 100,
    "review_score": 85
  },
  "details": {
    "has_verified_license": true,
    "review_count": 12,
    "average_rating": 4.7,
    "profile_complete": true
  }
}
```

**Grading Weights:**
- 40% Profile Completeness
- 30% License Verification
- 30% Reviews/Ratings

**Profile Score Breakdown (100 points max):**
- Company name: 10 points
- Phone: 10 points
- Trade: 10 points
- Years in business: 10 points
- Complete location (city, state, ZIP): 10 points
- Profile complete flag: 20 points
- Social media (5 points each, max 15 for 3+ platforms)

**License Score Breakdown (100 points max):**
- Verified license: 80 points
- Active, unexpired license: 100 points
- Pending verification: 30 points
- No license: 0 points

**Review Score Breakdown (100 points max):**
- Average rating converted to 0-100 (1 star = 0, 5 stars = 100)
- Bonus: +2 points per review (max +10 for 5+ reviews)
- No reviews: Neutral 50 points

**Grade Scale:**
- A+ (90-100): Excellent - Fully verified, complete profile, great reviews
- A (85-89): Excellent - Verified license and strong profile
- A- (80-84): Very Good - Verified license, good profile
- B+ (75-79): Good - Verified license, decent profile
- B (70-74): Good - Most requirements met
- B- (65-69): Above Average - Room for improvement
- C+ (60-64): Average - Basic requirements met
- C (55-59): Average - Some verification needed
- C- (50-54): Below Average - Limited verification
- D (40-49): Fair - Minimal verification
- F (0-39): Poor - Not verified or incomplete

**contractor_directory_view** - Optimized view for directory queries
- Joins user_profiles, contractor_licenses, contractor_ratings
- Pre-calculates grade, review count, average rating
- Filters to profile_complete = true contractors only

**calculate_distance_miles(from_zip, to_zip)** - ZIP code distance
- Placeholder function (returns mock distances)
- In production: integrate with ZIP code geocoding database

### 2. API Endpoints (`server.js`)

#### GET /api/contractors/directory
Search and filter contractor directory

**Query Parameters:**
- `trade` - Filter by trade type (general_contractor, plumbing, electrical, etc.)
- `minGrade` - Minimum grade (A, B, C, etc.)
- `maxDistance` - Maximum distance in miles (requires `zip`)
- `searchTerm` - Search contractor name or trade
- `zip` - User ZIP code for distance calculation
- `limit` - Results limit (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "contractors": [
    {
      "id": "uuid",
      "email": "contractor@example.com",
      "contractor_name": "Smith Remodeling Group",
      "trade": "general_contractor",
      "years_in_business": 12,
      "city": "Seattle",
      "state": "WA",
      "zip_code": "98101",
      "phone": "(206) 555-0123",
      "profile_complete": true,
      "grade": "A+",
      "grade_score": 92.5,
      "grade_color": "#10b981",
      "grade_breakdown": {
        "profile_score": 95,
        "license_score": 100,
        "review_score": 85
      },
      "has_verified_license": true,
      "licensed_trade": "general_contractor",
      "license_state": "WA",
      "review_count": 12,
      "average_rating": 4.7,
      "distance_miles": 5,
      "instagram_url": "https://instagram.com/smithremodeling",
      "facebook_url": "https://facebook.com/smithremodeling"
    }
  ],
  "total": 1,
  "filters": {
    "trade": "general_contractor",
    "minGrade": "A",
    "maxDistance": "25",
    "searchTerm": "",
    "zip": "98101"
  }
}
```

**Features:**
- ✅ Search by contractor name, trade, or service
- ✅ Filter by trade type
- ✅ Filter by minimum grade
- ✅ Filter by location (ZIP + distance)
- ✅ Enriches results with grade, license status, reviews
- ✅ Sorts by grade score (highest first)
- ✅ Pagination support

#### GET /api/contractors/:email/grade
Get detailed grade breakdown for specific contractor

**Response:**
```json
{
  "grade": "A+",
  "score": 92.5,
  "color": "#10b981",
  "breakdown": {
    "profile_score": 95,
    "license_score": 100,
    "review_score": 85
  },
  "details": {
    "has_verified_license": true,
    "review_count": 12,
    "average_rating": 4.7,
    "profile_complete": true
  }
}
```

#### GET /api/contractors/:email/reviews
Get reviews for specific contractor

**Query Parameters:**
- `limit` - Number of reviews (default: 10)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "contractor_email": "contractor@example.com",
      "homeowner_email": "homeowner@example.com",
      "quality_rating": 5,
      "communication_rating": 5,
      "timeliness_rating": 4,
      "professionalism_rating": 5,
      "value_rating": 4,
      "review_title": "Excellent kitchen remodel",
      "review_text": "Smith Remodeling did an amazing job...",
      "would_recommend": true,
      "verified_job": true,
      "created_at": "2024-01-15T10:30:00Z",
      "homeowner": {
        "full_name": "Jane Doe",
        "city": "Seattle",
        "state": "WA"
      }
    }
  ],
  "total": 12
}
```

### 3. Professional UI (`public/contractor-directory-new.html`)

#### Features:

**Search Bar:**
- Full-text search by contractor name, trade, or service
- Real-time filtering
- Enter key support

**Filters:**
- Trade dropdown (13 trades: general_contractor, plumbing, electrical, hvac, roofing, painting, landscaping, flooring, carpentry, masonry, concrete, drywall, insulation)
- Minimum grade dropdown (Any, A+, B+, C+)
- ZIP code input with validation (5 digits)
- Distance radius dropdown (5, 10, 25, 50 miles)

**Active Filter Tags:**
- Visual display of applied filters
- Click X to remove individual filters
- Auto-updates on filter changes

**Contractor Cards:**
- Large avatar with initials
- Contractor name (bold, prominent)
- Color-coded grade badge
- Verified license badge (green checkmark)
- Trade badge
- Years of experience badge
- Star rating display (★★★★☆ 4.7)
- Review count
- Location (city, state)
- Distance (miles away)
- Hover effects (lift + shadow)
- View Profile button
- Contact button

**Responsive Design:**
- Mobile-first approach
- Stacked layout on small screens
- Touch-friendly buttons
- Collapsible filters on mobile

**Loading States:**
- Spinner during initial load
- "Loading contractors..." message

**Empty States:**
- "No contractors found" message
- Helpful guidance to adjust filters

### 4. Reusable Component (`public/components/grade-badge.js`)

#### GradeBadge Class

**Methods:**

`GradeBadge.create(gradeData, options)` - Create badge element
```javascript
const badge = GradeBadge.create(
  {
    grade: 'A+',
    score: 92.5,
    color: '#10b981',
    breakdown: {
      profile_score: 95,
      license_score: 100,
      review_score: 85
    }
  },
  {
    size: 'medium', // 'small', 'medium', 'large'
    showTooltip: true,
    showBreakdown: true,
    className: 'custom-class'
  }
);

document.getElementById('grade-container').appendChild(badge);
```

`GradeBadge.fetchAndRender(contractorEmail, targetElement, options)` - Async fetch and render
```javascript
await GradeBadge.fetchAndRender(
  'contractor@example.com',
  '#grade-container',
  { size: 'large', showBreakdown: true }
);
```

`GradeBadge.getColor(grade)` - Get color by grade letter
```javascript
const color = GradeBadge.getColor('A+'); // Returns '#10b981'
```

`GradeBadge.getDescription(grade)` - Get description
```javascript
const desc = GradeBadge.getDescription('A+');
// Returns 'Excellent - Fully verified license, complete profile, great reviews'
```

**Features:**
- Color-coded badges (A+ green, B blue, C yellow, D/F red)
- Interactive tooltips with score breakdown
- Three size options
- Keyboard accessible
- Error handling for failed API calls

## 🚀 Usage Examples

### Display Contractor Directory

```javascript
// The directory loads automatically on page load
// Users can search, filter, and sort contractors

// Example: Apply filters programmatically
currentFilters = {
  searchTerm: 'plumber',
  trade: 'plumbing',
  minGrade: 'B',
  zip: '98101',
  maxDistance: '25'
};
loadContractors();
```

### Show Grade Badge

```javascript
// In any HTML page, add the script:
<script src="/components/grade-badge.js"></script>

// Then create badge:
<div id="contractor-grade"></div>

<script>
// Option 1: From existing data
const badge = GradeBadge.create({
  grade: 'A+',
  score: 92.5,
  color: '#10b981'
}, { size: 'large' });
document.getElementById('contractor-grade').appendChild(badge);

// Option 2: Fetch from API
GradeBadge.fetchAndRender(
  'contractor@example.com',
  '#contractor-grade',
  { showBreakdown: true }
);
</script>
```

### Calculate Grade

```javascript
// In SQL:
SELECT calculate_contractor_grade('contractor@example.com');

// Via API:
const response = await fetch('/api/contractors/contractor@example.com/grade');
const grade = await response.json();
console.log(grade.grade); // 'A+'
console.log(grade.score); // 92.5
```

## 📊 Testing

### 1. Run Database Schema

```sql
-- In Supabase SQL Editor:
-- 1. Run database/schema-fixed.sql (if not already done)
-- 2. Run database/subscriptions-schema.sql (if not already done)
-- 3. Run database/contractor-grading.sql
```

### 2. Test Grading Algorithm

```sql
-- Create test contractor
INSERT INTO user_profiles (email, role, company_name, trade, years_in_business, city, state, zip_code, phone, profile_complete)
VALUES ('test@contractor.com', 'contractor', 'Test Contracting LLC', 'general_contractor', 10, 'Seattle', 'WA', '98101', '(206) 555-0100', true);

-- Add verified license
INSERT INTO contractor_licenses (contractor_email, contractor_id, trade_type, license_number, state, verification_status, verified_at)
VALUES ('test@contractor.com', (SELECT id FROM user_profiles WHERE email = 'test@contractor.com'), 'general_contractor', 'GC123456', 'WA', 'verified', NOW());

-- Add review
INSERT INTO contractor_ratings (contractor_email, homeowner_email, quality_rating, communication_rating, timeliness_rating, professionalism_rating, value_rating, verified_job)
VALUES ('test@contractor.com', 'homeowner@example.com', 5, 5, 4, 5, 4, true);

-- Calculate grade
SELECT calculate_contractor_grade('test@contractor.com');
-- Should return A+ or A grade
```

### 3. Test API Endpoints

```bash
# Get directory
curl "http://localhost:3000/api/contractors/directory?limit=10"

# Search contractors
curl "http://localhost:3000/api/contractors/directory?searchTerm=plumber"

# Filter by trade
curl "http://localhost:3000/api/contractors/directory?trade=plumbing"

# Filter by grade
curl "http://localhost:3000/api/contractors/directory?minGrade=A"

# Filter by location
curl "http://localhost:3000/api/contractors/directory?zip=98101&maxDistance=25"

# Get specific contractor grade
curl "http://localhost:3000/api/contractors/test@contractor.com/grade"

# Get contractor reviews
curl "http://localhost:3000/api/contractors/test@contractor.com/reviews"
```

### 4. Test UI

1. Navigate to `/contractor-directory-new.html`
2. Try searching for contractors
3. Apply filters (trade, grade, location)
4. View active filter tags
5. Click on contractor cards
6. Hover over grade badges to see tooltips
7. Test on mobile devices (responsive design)

## 🎨 UI Color Scheme

**Grades:**
- A+, A, A-: `#10b981` (Green)
- B+, B, B-: `#3b82f6` (Blue)
- C+, C, C-: `#f59e0b` (Yellow/Orange)
- D: `#f97316` (Dark Orange)
- F: `#ef4444` (Red)
- N/A: `#6b7280` (Gray)

**Badges:**
- Verified License: `#10b981` (Green)
- Info Badges: `#f3f4f6` (Light Gray)

## 📁 Files Created/Modified

### Created:
- `database/contractor-grading.sql` - Grading algorithm and tables
- `public/contractor-directory-new.html` - Professional directory UI
- `public/components/grade-badge.js` - Reusable grade badge component
- `CONTRACTOR_DIRECTORY_README.md` - This documentation

### Modified:
- `server.js` - Added contractor directory API endpoints (lines 3312-3540)

## 🔄 Integration Points

### With Existing Features:

1. **User Profiles** - Uses user_profiles table for contractor data
2. **License Verification** - Uses contractor_licenses table for verification status
3. **Subscription System** - Can gate premium features (e.g., top placement for Premium tier)
4. **Job Postings** - Link contractors to jobs they've bid on or completed
5. **Messaging** - Contact button can open messaging with contractor

### Future Enhancements:

1. **Real ZIP Code Distances** - Integrate geocoding API for accurate distances
2. **Advanced Sorting** - Sort by distance, rating, years of experience
3. **Saved Searches** - Allow homeowners to save filter preferences
4. **Contractor Profiles** - Individual profile pages with full details
5. **Portfolio/Photos** - Display contractor work samples
6. **Availability Calendar** - Show contractor availability
7. **Insurance Tracking** - Track and display insurance verification
8. **Certifications** - Display additional certifications beyond licenses
9. **Specialties** - More granular trade specialties
10. **Price Range** - Typical price ranges for contractor services

## 🚀 Deployment Checklist

- [ ] Run `database/contractor-grading.sql` in Supabase
- [ ] Test grading calculation with sample data
- [ ] Test all API endpoints
- [ ] Test directory UI with real data
- [ ] Verify mobile responsiveness
- [ ] Test grade badge component
- [ ] Replace contractor-directory.html with contractor-directory-new.html (or redirect)
- [ ] Update navigation links to point to new directory
- [ ] Add analytics tracking for directory usage
- [ ] Monitor API performance with large contractor datasets
- [ ] Set up cron job to recalculate grades periodically

## Branch

All changes committed to: `claude/code-review-refactor-adPWF`

Total commits for contractor directory: 2
- Grading algorithm + API endpoints
- Professional UI + Grade badge component
