// Load environment variables from .env file
require('dotenv').config();

// ====== IMPORTS ======
const express = require("express");
const cors = require("cors");
const path = require('path');
const fs = require('fs');
const db = require('./database/db');

// node-fetch v3 for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ====== ENVIRONMENT VALIDATION ======
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ CRITICAL: ANTHROPIC_API_KEY is not set in environment variables.");
  console.error("   Please add it to your .env file to enable AI features.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️  WARNING: Supabase credentials not configured. Authentication will not work.");
  console.warn("   Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.");
}

const app = express();

// ====== MIDDLEWARE ======

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// JSON body parser with size limit for image uploads
app.use(express.json({ limit: "10mb" }));

// Error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON format in request body.' });
  }
  next(err);
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.homeprohub.today',
  'https://homeprohub.today',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy violation: Origin ${origin} is not allowed.`;
      console.warn(`⚠️  ${msg}`);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Serve static files from /public directory
app.use(express.static("public"));

// ====== UTILITY FUNCTIONS ======

/**
 * Validates and sanitizes string inputs
 */
function sanitizeInput(input, maxLength = 5000) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength);
}

/**
 * Validates ZIP code format
 */
function isValidZip(zip) {
  if (!zip) return false;
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Loads JSON file safely with error handling
 */
function loadJsonFile(filename) {
  try {
    const filePath = path.resolve(__dirname, 'public', filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  JSON file not found: ${filename}`);
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error.message);
    return null;
  }
}

// ====== AUTHENTICATION MIDDLEWARE ======

const { createClient } = require('@supabase/supabase-js');

// Create Supabase client for auth verification
const supabaseAuth = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * Middleware to verify Supabase JWT token
 * Extracts token from Authorization header and validates it
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_AUTH_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication verification failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware to require specific role
 */
function requireRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NO_AUTH'
        });
      }

      // Get user profile from database to check role
      const profile = await db.getUserProfile(req.user.email);

      if (!profile || profile.role !== role) {
        return res.status(403).json({
          error: `Access denied. ${role} role required.`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Attach profile to request
      req.userProfile = profile;
      next();

    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        error: 'Role verification failed',
        code: 'ROLE_CHECK_ERROR'
      });
    }
  };
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and guest users
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

      if (!error && user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't fail - just continue without user
    next();
  }
}

// --- FINAL AUTH API ROUTES (Client-Side Auth) ---

// ====== API ROUTES ======

/**
 * GET /api/config
 * Returns client configuration (Supabase credentials)
 */
app.get('/api/config', (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({
        error: 'Authentication service not configured.',
        code: 'AUTH_NOT_CONFIGURED'
      });
    }

    res.json({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    });

  } catch (error) {
    console.error('Error in /api/config:', error);
    return res.status(500).json({ error: 'Internal server error fetching config.' });
  }
});

// ====== AUTHENTICATION ENDPOINTS ======

/**
 * POST /api/auth/signup
 * Create a new user account with Supabase Auth
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, role, ...userData } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'Email, password, and role are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate role
    if (!['homeowner', 'contractor'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be either "homeowner" or "contractor"',
        code: 'INVALID_ROLE'
      });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: role,
          ...userData
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      return res.status(400).json({
        error: error.message,
        code: 'SIGNUP_FAILED'
      });
    }

    // Create user profile in database
    if (data.user) {
      try {
        const profile = await db.upsertUserProfile({
          id: data.user.id,
          email: email,
          role: role,
          full_name: userData.full_name || null,
          phone: userData.phone || null,
          company_name: userData.company_name || null,
          address: userData.address || null,
          city: userData.city || null,
          state: userData.state || null,
          zip_code: userData.zip_code || null,
          email_verified: data.user.email_confirmed_at ? true : false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        console.log('✅ User profile created:', email, 'Role:', role);
      } catch (dbError) {
        console.error('Error creating user profile:', dbError);
        // Continue - auth user is created even if profile creation fails
      }
    }

    res.status(201).json({
      user: data.user,
      session: data.session,
      message: 'Account created successfully'
    });

  } catch (error) {
    console.error('Signup endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during signup',
      code: 'SIGNUP_ERROR'
    });
  }
});

/**
 * POST /api/auth/signin
 * Sign in an existing user
 */
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Sign in with Supabase
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Signin error:', error);
      return res.status(401).json({
        error: error.message,
        code: 'SIGNIN_FAILED'
      });
    }

    // Get user profile
    let profile = null;
    try {
      profile = await db.getUserProfile(email);
    } catch (dbError) {
      console.error('Error fetching user profile:', dbError);
    }

    console.log('✅ User signed in:', email);

    res.json({
      user: data.user,
      session: data.session,
      profile: profile,
      message: 'Signed in successfully'
    });

  } catch (error) {
    console.error('Signin endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during signin',
      code: 'SIGNIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/signout
 * Sign out the current user
 */
app.post('/api/auth/signout', requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);

    // Sign out from Supabase
    const { error } = await supabaseAuth.auth.signOut(token);

    if (error) {
      console.error('Signout error:', error);
    }

    console.log('✅ User signed out:', req.user.email);

    res.json({
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('Signout endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during signout',
      code: 'SIGNOUT_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh the access token
 */
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Refresh session with Supabase
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({
        error: error.message,
        code: 'REFRESH_FAILED'
      });
    }

    res.json({
      session: data.session,
      user: data.user,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Refresh endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during token refresh',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * GET /api/auth/user
 * Get current authenticated user and profile
 */
app.get('/api/auth/user', requireAuth, async (req, res) => {
  try {
    // Get user profile from database
    const profile = await db.getUserProfile(req.user.email);

    res.json({
      user: req.user,
      profile: profile,
      authenticated: true
    });

  } catch (error) {
    console.error('Get user endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error fetching user',
      code: 'FETCH_USER_ERROR'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Send password reset email
 */
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Send password reset email via Supabase
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password`
    });

    if (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({
        error: error.message,
        code: 'RESET_FAILED'
      });
    }

    console.log('✅ Password reset email sent to:', email);

    res.json({
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Reset password endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during password reset',
      code: 'RESET_ERROR'
    });
  }
});

/**
 * PUT /api/auth/update-password
 * Update user password (requires authentication)
 */
app.put('/api/auth/update-password', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'New password is required',
        code: 'MISSING_PASSWORD'
      });
    }

    // Update password via Supabase
    const { error } = await supabaseAuth.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Update password error:', error);
      return res.status(400).json({
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }

    console.log('✅ Password updated for:', req.user.email);

    res.json({
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Update password endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error during password update',
      code: 'UPDATE_ERROR'
    });
  }
});

/**
 * POST /api/set-role
 * Confirms role selection for user (placeholder for future database integration)
 */
app.post('/api/set-role', (req, res) => {
  try {
    const { username, role } = req.body;

    // Input validation
    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        error: 'Username is required and must be a string.',
        field: 'username'
      });
    }

    if (role && !['contractor', 'homeowner'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be either "contractor" or "homeowner".',
        field: 'role'
      });
    }

    // TODO: Save to database when implemented
    console.log(`✓ Role set for user: ${username} -> ${role || 'not specified'}`);

    return res.json({
      success: true,
      message: 'Role received and processed.',
      username: username,
      role: role
    });

  } catch (error) {
    console.error('Error in /api/set-role:', error);
    return res.status(500).json({ error: 'Internal server error processing role.' });
  }
});

/**
 * GET /api/get-user-status (alias for get-full-user-status)
 * Returns user profile status (mock implementation - replace with database)
 */
app.get('/api/get-user-status', (req, res) => {
  try {
    const username = req.query.username;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        error: 'Username query parameter is required.',
        field: 'username'
      });
    }

    const lowerUsername = username.toLowerCase();
    let role = null;

    if (lowerUsername.includes('contractor')) {
      role = 'contractor';
    } else if (lowerUsername.includes('homeowner')) {
      role = 'homeowner';
    }

    const profileCompleted = role === 'contractor' ? true : false;

    const responseData = {
      role: role,
      profileComplete: profileCompleted,
      companyName: profileCompleted ? `${username.split('@')[0]} Inc.` : null,
      license: profileCompleted ? 'CBC-98765' : null,
      zipCode: profileCompleted ? '33602' : null,
      _mockData: true
    };

    console.log(`✓ User status requested: ${username} -> Role: ${role || 'none'}`);

    return res.json(responseData);

  } catch (error) {
    console.error('Error in /api/get-user-status:', error);
    return res.status(500).json({ error: 'Internal server error fetching user status.' });
  }
});

/**
 * GET /api/get-full-user-status
 * Returns user profile status (mock implementation - replace with database)
 */
app.get('/api/get-full-user-status', (req, res) => {
  try {
    const username = req.query.username;

    // Input validation
    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        error: 'Username query parameter is required.',
        field: 'username'
      });
    }

    // MOCK: Determine role based on username pattern
    // TODO: Replace with actual database query
    let role = null;
    const lowerUsername = username.toLowerCase();

    if (lowerUsername.includes('contractor')) {
      role = 'contractor';
    } else if (lowerUsername.includes('homeowner')) {
      role = 'homeowner';
    }

    // MOCK: Profile completion status
    const profileCompleted = role === 'contractor' ? true : false;

    // MOCK: Generate sample profile data
    const responseData = {
      role: role,
      profileComplete: profileCompleted,
      companyName: profileCompleted ? `${username.split('@')[0]} Inc.` : null,
      license: profileCompleted ? 'CBC-98765' : null,
      zipCode: profileCompleted ? '33602' : null,
      _mockData: true // Flag indicating this is mock data
    };

    console.log(`✓ User status requested: ${username} -> Role: ${role || 'none'}`);

    return res.json(responseData);

  } catch (error) {
    console.error('Error in /api/get-full-user-status:', error);
    return res.status(500).json({ error: 'Internal server error fetching user status.' });
  }
});

/**
 * GET /api/get-role
 * Returns user role (mock implementation - replace with database)
 */
app.get('/api/get-role', (req, res) => {
  try {
    const username = req.query.username;

    // Input validation
    if (!username || typeof username !== 'string') {
      return res.status(400).json({
        error: 'Username query parameter is required.',
        field: 'username'
      });
    }

    // MOCK: Determine role based on username pattern
    // TODO: Replace with actual database query
    const lowerUsername = username.toLowerCase();
    let role = null;

    if (lowerUsername.includes('contractor')) {
      role = 'contractor';
    } else if (lowerUsername.includes('homeowner')) {
      role = 'homeowner';
    }

    console.log(`✓ Role check: ${username} -> ${role || 'no role assigned'}`);

    return res.json({
      role: role,
      _mockData: true
    });

  } catch (error) {
    console.error('Error in /api/get-role:', error);
    return res.status(500).json({ error: 'Internal server error fetching role.' });
  }
});

/**
 * POST /ask
 * Homeowner AI assistant - analyzes home issues OR job posting requests
 * Intelligently detects intent and provides appropriate response
 */
app.post("/ask", async (req, res) => {
  try {
    const { question, imageBase64, imageType } = req.body;

    // Input validation
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: "Question is required and must be a string.",
        field: 'question'
      });
    }

    const sanitizedQuestion = sanitizeInput(question, 3000);

    if (sanitizedQuestion.length === 0) {
      return res.status(400).json({
        error: "Question cannot be empty after sanitization.",
        field: 'question'
      });
    }

    // Validate image data if provided
    if (imageBase64) {
      if (!imageType || typeof imageType !== 'string') {
        return res.status(400).json({
          error: "imageType is required when imageBase64 is provided.",
          field: 'imageType'
        });
      }

      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(imageType)) {
        return res.status(400).json({
          error: `Invalid imageType. Must be one of: ${validImageTypes.join(', ')}`,
          field: 'imageType'
        });
      }
    }

    // Check if API key is configured
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: "AI service is not configured. Please contact support.",
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    // Build content blocks for Claude
    const contentBlocks = [];

    // Smart prompt that detects intent and responds appropriately
    contentBlocks.push({
      type: "text",
      text: `You are an experienced home contractor and home inspector helping homeowners.

The homeowner said:
${sanitizedQuestion}

FIRST, determine the intent:
- Is this about an EXISTING PROBLEM/ISSUE that needs fixing? (leak, crack, noise, smell, malfunction, damage, etc.)
- OR is this about a NEW PROJECT/REMODEL they want to do? (addition, remodel, renovation, upgrade, installation of something new, etc.)

INTENT TYPE: [Write either "ISSUE" or "PROJECT"]

If ISSUE (something broken/wrong that needs repair):
Respond using this structure:
1. Summary, Severity & Urgency: [1-2 sentence summary, Severity: High/Medium/Low, Urgency: Fix now/soon/monitor]
2. Estimated Budget Range: $[LOW] - $[HIGH] (provide realistic cost estimate for professional repair)
3. Likely Causes: [2-5 bullet points]
4. Step-by-Step Checks (DIY-friendly): [Numbered steps they can do to diagnose]
5. Materials & Tools You May Need: [Short bullet list if DIY-able]
6. Safety Warnings: [Clear bullet points, be specific about dangers]
7. When to Call a Pro: [Explain when and what type of contractor - plumber, electrician, etc.]
8. What to Tell a Contractor: [Short script they can use]

If PROJECT (new work they want done):
Respond using this structure:
1. Project Summary: [2-3 sentence overview of what they're asking for]
2. Estimated Budget Range: $[LOW] - $[HIGH] (realistic range for this type of project in their area)
3. Scope Considerations: [Bullet points of what this typically includes]
4. Permits & Requirements: [What permits or approvals they'll likely need]
5. Timeline Estimate: [Typical duration for this project]
6. Contractor Type Needed: [What type of contractor - general contractor, specialist, etc.]
7. Key Questions for Contractors: [5-7 questions they should ask when getting bids]
8. Next Steps: [Clear action items - "Post this project to get bids from contractors"]

Be specific with budget estimates based on typical market rates. Consider the project scope described.`
    });

    // Optional image
    if (imageBase64 && imageType) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageType,
          data: imageBase64
        }
      });
    }

    // Call Anthropic API with increased token limit for detailed responses
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: contentBlocks
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Anthropic API error (${apiResponse.status}):`, errorText);

      return res.status(apiResponse.status >= 500 ? 503 : 500).json({
        error: "AI service error. Please try again.",
        code: 'AI_SERVICE_ERROR',
        status: apiResponse.status
      });
    }

    const data = await apiResponse.json();

    const answer = data.content && data.content[0]?.text
      ? data.content[0].text
      : "No response generated.";

    // Detect intent from response
    const isProject = answer.includes('INTENT TYPE: PROJECT') ||
                      answer.includes('Project Summary:') ||
                      answer.includes('Next Steps:');
    const isIssue = answer.includes('INTENT TYPE: ISSUE') ||
                    answer.includes('Likely Causes:') ||
                    !isProject;

    console.log(`✓ Homeowner question answered (${answer.length} chars, type: ${isProject ? 'PROJECT' : 'ISSUE'})`);

    res.json({
      answer,
      intent: isProject ? 'project' : 'issue',
      autoRedirect: isProject // Signal frontend to auto-redirect to job posting
    });

  } catch (err) {
    console.error("❌ Error in /ask:", err);
    res.status(500).json({
      error: "Internal server error processing your question.",
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /contractor-ask
 * Contractor coach AI with RAG (Retrieval-Augmented Generation) for pricing
 */
app.post("/contractor-ask", async (req, res) => {
  try {
    const { question, focus, zip, scopeLevel, size } = req.body;

    // Input validation
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: "Question is required and must be a string.",
        field: 'question'
      });
    }

    const sanitizedQuestion = sanitizeInput(question, 3000);

    if (sanitizedQuestion.length === 0) {
      return res.status(400).json({
        error: "Question cannot be empty after sanitization.",
        field: 'question'
      });
    }

    // Validate focus area
    const validFocus = ['general', 'pricing', 'materials', 'licensing', 'client_comms', 'business'];
    const selectedFocus = focus && validFocus.includes(focus) ? focus : 'general';

    // Validate ZIP code if provided
    if (zip && !isValidZip(zip)) {
      return res.status(400).json({
        error: "Invalid ZIP code format. Must be 5 digits (e.g., 12345) or ZIP+4 (e.g., 12345-6789).",
        field: 'zip'
      });
    }

    // Check if API key is configured
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: "AI service is not configured. Please contact support.",
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    // --- RAG IMPLEMENTATION: LOAD COST DATA ---
    let ragData = {
      laborRates: 'unavailable',
      permits: 'unavailable',
      regionalMultiplier: 1.0
    };

    const laborData = loadJsonFile('labor-rates.json');
    const permitData = loadJsonFile('permit-fees.json');

    if (laborData && permitData) {
      // Determine regional multiplier based on ZIP prefix
      const zipPrefix = zip ? zip.substring(0, 3) : 'other';
      const multiplier = laborData.regional_multipliers?.[zipPrefix]
        || laborData.regional_multipliers?.['other']
        || 1.0;

      ragData = {
        laborRates: laborData.rates_by_trade || {},
        regionalMultiplier: multiplier,
        samplePermitFees: permitData.projects || []
      };

      console.log(`✓ RAG data loaded: ZIP ${zip || 'N/A'}, Multiplier ${multiplier}`);
    } else {
      console.warn('⚠️  RAG data unavailable, using fallback');
    }
    // --- END RAG IMPLEMENTATION ---

    // Build focus description
    const focusDescription = {
      general: "General contractor / project advice",
      pricing: "Pricing and estimating jobs profitably and fairly",
      materials: "Materials, methods, and build quality trade-offs",
      licensing: "Licensing, insurance, permitting and compliance",
      client_comms: "Client communication, expectations and change orders",
      business: "Business systems, profitability and long-term strategy"
    }[selectedFocus] || "General contractor guidance";

    // Build prompt based on focus
    let contentText;
    let maxTokens = 900;

    if (selectedFocus === "pricing") {
      // For pricing, return ONLY JSON
      maxTokens = 1500;
      contentText = `You are an experienced estimating expert for contractors. Analyze this job and create a detailed estimate.

--- BEGIN RAG CONTEXT ---
Labor Rates (Base $/hr): ${JSON.stringify(ragData.laborRates)}
Regional Multiplier for ZIP ${zip || 'N/A'}: ${ragData.regionalMultiplier}
Permit Cost Samples: ${JSON.stringify(ragData.samplePermitFees)}
--- END RAG CONTEXT ---

JOB DESCRIPTION: ${sanitizedQuestion}
ZIP CODE: ${zip || "Not provided"}
SCOPE LEVEL: ${scopeLevel || 'mid'}
PROJECT SIZE: ${size || 'Not specified'}

CRITICAL: Your response MUST be ONLY a valid JSON object. No explanatory text before or after.

If ZIP code is missing, return: {"error": "ZIP code is required for pricing estimates"}

Otherwise, return a JSON object with this EXACT structure:
{
  "status": "ok",
  "project_title": "Brief descriptive title",
  "line_items": [
    {"item": "Labor - [Trade Name]", "low": 0, "high": 0, "notes": "Brief description"},
    {"item": "Materials - [Material Type]", "low": 0, "high": 0, "notes": "Brief description"}
  ],
  "subtotal_low": 0,
  "subtotal_high": 0,
  "overhead_profit_percent": 20,
  "contingency_percent": 10,
  "total_projected_low": 0,
  "total_projected_high": 0,
  "disclaimers": [
    "This is a preliminary budget estimate based on typical costs",
    "Final pricing requires site visit and detailed scope review",
    "Costs adjusted for ZIP ${zip} using regional multiplier ${ragData.regionalMultiplier}"
  ]
}

IMPORTANT CALCULATION RULES:
1. Use the provided labor rates and multiply by regional multiplier ${ragData.regionalMultiplier}
2. Break down labor by trade (e.g., Electrician, Plumber, Carpenter)
3. Include material costs as separate line items
4. Subtotal = sum of all line item lows/highs
5. Total = Subtotal + (Subtotal * overhead_profit_percent/100) + (Subtotal * contingency_percent/100)
6. All values in whole dollars (no decimals)`;
    } else {
      // For non-pricing questions, return formatted text
      contentText = `You are an experienced, licensed contractor and business mentor.

--- BEGIN RAG CONTEXT ---
Labor Rates (Base $/hr): ${JSON.stringify(ragData.laborRates)}
Permit Cost Samples: ${JSON.stringify(ragData.samplePermitFees)}
Regional Multiplier: ${ragData.regionalMultiplier}
--- END RAG CONTEXT ---

FOCUS AREA: ${focusDescription}
JOB ZIP (if provided): ${zip || "Not provided"}

Contractor's situation:
${sanitizedQuestion}

Give practical, grounded advice based on real-world experience in a conversational, helpful tone.
Avoid guessing about local code specifics—remind them to check their local code and licensing board if needed.

Respond using this structure:

**Quick Summary**
[2-3 sentences summarizing the situation and your recommendation]

**Key Considerations**
• [Point 1]
• [Point 2]
• [Point 3]

**Suggested Approach**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Next Moves**
• [Action 1]
• [Action 2]
• [Action 3]

Keep your response practical, specific, and action-oriented.`;
    }

    // Call Anthropic API
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: contentText
              }
            ]
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Anthropic API error (contractor) (${apiResponse.status}):`, errorText);

      return res.status(apiResponse.status >= 500 ? 503 : 500).json({
        error: "AI service error. Please try again.",
        code: 'AI_SERVICE_ERROR',
        status: apiResponse.status
      });
    }

    const data = await apiResponse.json();
    const rawAnswer = data.content[0]?.text?.trim() || "No response generated.";

    // For pricing questions, attempt JSON parsing
    if (selectedFocus === "pricing") {
      try {
        const cleanedJson = rawAnswer.replace(/```json\s*|```/g, '').trim();
        const jsonAnswer = JSON.parse(cleanedJson);

        console.log(`✓ Contractor estimate generated (JSON)`);
        return res.json({ answer: jsonAnswer, format: 'json' });

      } catch (jsonErr) {
        console.warn('⚠️  JSON parse failed for pricing response:', jsonErr.message);
        return res.json({
          answer: rawAnswer,
          format: 'text',
          parseError: "AI response was not valid JSON."
        });
      }
    } else {
      console.log(`✓ Contractor question answered (${selectedFocus}, ${rawAnswer.length} chars)`);
      return res.json({ answer: rawAnswer, format: 'text' });
    }

  } catch (err) {
    console.error("❌ Error in /contractor-ask:", err);
    res.status(500).json({
      error: "Internal server error processing your question.",
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /plan-project
 * Homeowner project planner - creates detailed project breakdown
 */
app.post("/plan-project", async (req, res) => {
  try {
    const { projectDescription, location } = req.body;

    if (!projectDescription || typeof projectDescription !== 'string') {
      return res.status(400).json({
        error: "Project description is required and must be a string.",
        field: 'projectDescription'
      });
    }

    const sanitizedDescription = sanitizeInput(projectDescription, 2000);
    if (sanitizedDescription.length === 0) {
      return res.status(400).json({
        error: "Project description cannot be empty after sanitization.",
        field: 'projectDescription'
      });
    }

    const sanitizedLocation = location ? sanitizeInput(location, 100) : null;

    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: "AI service is not configured. Please contact support.",
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const locationHint = sanitizedLocation
      ? `The project location is: ${sanitizedLocation}. Use this to inform local cost estimates and permitting mentions.`
      : "No specific location was provided; use generic national averages for cost and time.";

    const contentText = `You are an experienced residential Project Manager and Home Remodel Consultant.
Your task is to take a homeowner's simple idea and create a realistic, phase-based project plan.
The goal is to prepare the homeowner for conversations with contractors and help them understand the scope, complexity, and budget.

Project Idea: ${sanitizedDescription}
${locationHint}

Respond using EXACTLY this structure:

1. Project Summary & Complexity:
- A brief (2-sentence) summary of the work.
- Complexity Level: Low / Medium / High (pick one, considering unknowns).

2. Trades Required:
- A bullet list of the primary trade licenses and professionals needed (e.g., General Contractor, Plumber, Electrician, Designer).

3. Phase Breakdown & Timeline (Steps):
- A numbered list of the project phases, ordered sequentially.
- For each phase, list 2-4 key tasks and a rough timeline (e.g., 1-2 days, 1-2 weeks).
- Phases should cover: Design/Planning, Demolition, Rough-in/Framing, Finishes/Installation, Cleanup/Punch list.

4. Rough Budget Placeholder:
- Give a range estimate (Low End / High End) in USD for the entire project, based on the description and location hint.
- Clearly state that this is a placeholder and should only be finalized with contractor quotes.
- Break the estimate into: Materials (%), Labor (%), Overhead (%).

5. Key Decisions Needed:
- A bullet list of 3-5 critical decisions the homeowner must make before construction starts (e.g., fixture selection, structural review, permit application).

6. Permits & Local Requirements:
- Mention common permit types likely needed (e.g., electrical, plumbing, building) and advise the homeowner to check local municipal codes immediately.
`;

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: contentText }]
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Anthropic API error (planner) (${apiResponse.status}):`, errorText);
      return res.status(apiResponse.status >= 500 ? 503 : 500).json({
        error: "AI service error. Please try again.",
        code: 'AI_SERVICE_ERROR',
        status: apiResponse.status
      });
    }

    const data = await apiResponse.json();
    const answer = data.content && data.content[0]?.text
      ? data.content[0].text
      : "No response generated.";

    console.log(`✓ Project plan generated (${answer.length} chars)`);
    res.json({ answer });

  } catch (err) {
    console.error("❌ Error in /plan-project:", err);
    res.status(500).json({
      error: "Internal server error processing your project.",
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/project-checkin/analyze
 * Analyze construction progress photos for red flags using AI
 */
app.post("/api/project-checkin/analyze", async (req, res) => {
  try {
    const { photos, description, userEmail } = req.body;

    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: "AI analysis service is not configured",
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    if ((!photos || photos.length === 0) && !description) {
      return res.status(400).json({
        error: "Please provide at least one photo or description",
        code: 'VALIDATION_ERROR'
      });
    }

    console.log(`📸 Analyzing project check-in for: ${userEmail} (${photos?.length || 0} photos)`);

    // Build content for Claude API
    const contentBlocks = [];

    // Add expert system prompt
    contentBlocks.push({
      type: "text",
      text: `You are an expert construction inspector and project manager with 20+ years of experience.
You're helping a homeowner review their ongoing construction project to identify any red flags or issues that could indicate poor workmanship, incorrect sequencing, or potential problems.

CRITICAL RED FLAGS TO WATCH FOR:
- Work done out of sequence (e.g., drywall before electrical rough-in, tiling before waterproofing)
- Missing critical steps (waterproofing, vapor barriers, proper flashing)
- Poor workmanship (uneven cuts, gaps, misaligned work)
- Code violations or safety hazards
- Inadequate prep work
- Use of wrong materials for the application
- Signs of rushing or cutting corners

Homeowner's description:
${description || 'No description provided - analyze the photos'}

Analyze the photos carefully and provide:

1. SUMMARY: Brief overview of what you see (1-2 sentences)

2. RED FLAGS: List any serious issues or concerns you detect. Be specific about what's wrong and why it matters.
   - If you see work done out of sequence, explain the correct order
   - If you see missing steps, explain what should have been done
   - If you see poor workmanship, describe what's wrong

3. RECOMMENDATIONS: Specific actions the homeowner should take
   - Should they stop work immediately?
   - What questions should they ask their contractor?
   - What should be fixed or redone?
   - If everything looks good, reassure them!

Be direct and clear. If you see red flags, call them out. If everything looks fine, say so. The homeowner needs your honest expert opinion.`
    });

    // Add photos as image blocks
    if (photos && photos.length > 0) {
      photos.forEach((photo, index) => {
        // Extract base64 data and media type
        const matches = photo.data.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mediaType = matches[1];
          const base64Data = matches[2];

          contentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data
            }
          });
        }
      });
    }

    // Call Claude API with vision
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ role: "user", content: contentBlocks }]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      console.error("❌ Anthropic API error:", errorData);
      throw new Error('AI analysis service error');
    }

    const data = await apiResponse.json();
    const analysisText = data.content && data.content[0]?.text
      ? data.content[0].text
      : "Unable to analyze at this time.";

    // Parse the analysis into structured format
    const result = parseAnalysis(analysisText);

    console.log(`✓ Project check-in analyzed for: ${userEmail}`);

    // Log activity
    await db.logActivity({
      user_email: userEmail,
      activity_type: 'project_checkin_analysis',
      description: 'Analyzed project progress photos',
      metadata: {
        photo_count: photos?.length || 0,
        has_description: !!description,
        red_flags_found: result.redFlags.length
      }
    });

    res.json(result);

  } catch (err) {
    console.error("❌ Error in /api/project-checkin/analyze:", err);
    res.status(500).json({
      error: "Failed to analyze project",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// Helper function to parse AI analysis into structured format
function parseAnalysis(text) {
  const lines = text.split('\n');
  let summary = '';
  const redFlags = [];
  const recommendations = [];
  let currentSection = '';

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.match(/^(SUMMARY|1\.|Summary:)/i)) {
      currentSection = 'summary';
      // Extract summary text
      const summaryMatch = trimmed.match(/^(?:SUMMARY|1\.|Summary:)\s*(.+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1];
      }
    } else if (trimmed.match(/^(RED FLAGS|2\.|Red Flags:)/i)) {
      currentSection = 'redFlags';
    } else if (trimmed.match(/^(RECOMMENDATIONS|3\.|Recommendations:)/i)) {
      currentSection = 'recommendations';
    } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
      // Extract bullet point or numbered item
      const itemText = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '');
      if (itemText && currentSection === 'redFlags') {
        redFlags.push(itemText);
      } else if (itemText && currentSection === 'recommendations') {
        recommendations.push(itemText);
      } else if (currentSection === 'summary' && !summary) {
        summary += ' ' + itemText;
      }
    } else if (trimmed && currentSection === 'summary' && !summary.includes(trimmed)) {
      summary += ' ' + trimmed;
    }
  });

  return {
    summary: summary.trim() || 'Analysis complete',
    redFlags: redFlags,
    recommendations: recommendations.length > 0 ? recommendations : [
      'Continue monitoring your project progress',
      'Document everything with photos',
      'Ask your contractor if you have any questions'
    ]
  };
}

/**
 * GET /grading-data
 * Returns contractor/homeowner grading logic and criteria
 */
app.get("/grading-data", (req, res) => {
  try {
    const gradingData = loadJsonFile('grading-logic.json');

    if (!gradingData) {
      return res.status(404).json({
        error: "Grading logic file not found or could not be read.",
        code: 'FILE_NOT_FOUND'
      });
    }

    console.log('✓ Grading data served');
    res.json(gradingData);

  } catch (err) {
    console.error("❌ Error in /grading-data:", err);
    res.status(500).json({
      error: "Internal server error loading grading data.",
      code: 'INTERNAL_ERROR'
    });
  }
});

// ========================================
// DATABASE API ENDPOINTS
// ========================================
const emailService = require('./email/email-service');

// Load license requirements data
let licenseRequirements = null;
try {
  const licenseDataPath = path.resolve(__dirname, 'database', 'license-requirements.json');
  if (fs.existsSync(licenseDataPath)) {
    licenseRequirements = JSON.parse(fs.readFileSync(licenseDataPath, 'utf8'));
    console.log('✓ License requirements data loaded');
  } else {
    console.warn('⚠️  License requirements file not found');
  }
} catch (error) {
  console.error('❌ Error loading license requirements:', error.message);
}

/**
 * GET /api/license/status
 * Get current license verification status for a contractor
 */
app.get("/api/license/status", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const profile = await db.getUserProfile(email);

    if (!profile) {
      return res.status(404).json({
        error: "Profile not found",
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      license_verified: profile.license_verified || 'unverified',
      license_state: profile.license_state,
      license_number: profile.license_number,
      license_type: profile.license_type,
      license_expiration: profile.license_expiration,
      verified_at: profile.verified_at,
      verification_id: profile.verification_id
    });

  } catch (err) {
    console.error("❌ Error in /api/license/status:", err);
    res.status(500).json({
      error: "Failed to fetch license status",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/license/submit
 * Submit contractor license and insurance documents for verification
 */
app.post("/api/license/submit", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const {
      contractorEmail,
      licState,
      licNumber,
      licType,
      licExpiration,
      licenseDocument,
      insuranceProvider,
      insurancePolicyNumber,
      insuranceExpiration,
      insuranceCoverage,
      insuranceDocument
    } = req.body;

    // Validation
    if (!contractorEmail || !licState || !licNumber || !licType) {
      return res.status(400).json({
        error: "Missing required fields: contractorEmail, licState, licNumber, licType",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get contractor profile
    const contractorProfile = await db.getUserProfile(contractorEmail);
    if (!contractorProfile) {
      return res.status(404).json({
        error: "Contractor profile not found",
        code: 'NOT_FOUND'
      });
    }

    // Generate unique verification ID
    const verificationId = `lic_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Prepare license data
    const licenseData = {
      contractor_email: contractorEmail,
      contractor_id: contractorProfile.id,
      verification_id: verificationId,
      license_state: licState.toUpperCase(),
      license_number: licNumber,
      license_type: licType,
      license_expiration: licExpiration || null,
      insurance_provider: insuranceProvider || null,
      insurance_policy_number: insurancePolicyNumber || null,
      insurance_expiration: insuranceExpiration || null,
      insurance_coverage: insuranceCoverage || null,
      verification_status: 'pending',
      submitted_at: new Date().toISOString()
    };

    // For now, store documents as base64 in metadata (in production, use Supabase Storage)
    // This is a simplified version - you'd want to upload to storage and store URLs
    const metadata = {};
    if (licenseDocument) {
      metadata.license_document_preview = licenseDocument.substring(0, 100) + '...';
      metadata.license_document_size = licenseDocument.length;
    }
    if (insuranceDocument) {
      metadata.insurance_document_preview = insuranceDocument.substring(0, 100) + '...';
      metadata.insurance_document_size = insuranceDocument.length;
    }
    licenseData.metadata = metadata;

    // Save to database (we'll need to create this table/function)
    // For now, update contractor profile with license info
    await db.updateContractorLicense({
      email: contractorEmail,
      license_state: licState.toUpperCase(),
      license_number: licNumber,
      license_type: licType,
      license_expiration: licExpiration,
      license_verified: 'pending',
      verification_id: verificationId
    });

    // Send verification email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@homeprohub.today';
    const approveUrl = `${process.env.BASE_URL || 'https://www.homeprohub.today'}/api/license/verify?id=${verificationId}&action=approve`;
    const rejectUrl = `${process.env.BASE_URL || 'https://www.homeprohub.today'}/api/license/verify?id=${verificationId}&action=reject`;

    try {
      // Determine contractor name with proper fallback
      let contractorName = contractorProfile.business_name || contractorProfile.company_name;
      if (!contractorName && (contractorProfile.first_name || contractorProfile.last_name)) {
        contractorName = `${contractorProfile.first_name || ''} ${contractorProfile.last_name || ''}`.trim();
      }
      if (!contractorName) {
        contractorName = contractorEmail.split('@')[0]; // Use email username as last resort
      }

      // Load and render admin verification email template
      const template = emailService.loadTemplate('license-verification-request');
      const html = emailService.renderTemplate(template, {
        contractorName: contractorName,
        contractorEmail: contractorEmail,
        verificationId: verificationId,
        licenseState: licState.toUpperCase(),
        licenseNumber: licNumber,
        licenseType: licType,
        licenseExpiration: licExpiration || 'Not provided',
        insuranceProvider: insuranceProvider || 'Not provided',
        insurancePolicyNumber: insurancePolicyNumber || 'Not provided',
        insuranceCoverage: insuranceCoverage ? `$${parseInt(insuranceCoverage).toLocaleString()}` : 'Not provided',
        insuranceExpiration: insuranceExpiration || 'Not provided',
        approveUrl: approveUrl,
        rejectUrl: rejectUrl
      });

      await emailService.sendEmail({
        to: adminEmail,
        subject: `🔍 License Verification Request - ${contractorName}`,
        html: html,
        text: `New License Verification Request from ${contractorEmail}\n\nLicense: ${licState} ${licNumber}\nType: ${licType}\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}`
      });
      console.log(`✓ Verification request email sent to admin for ${contractorEmail}`);
    } catch (emailErr) {
      console.error('⚠️  Failed to send admin verification email:', emailErr.message);
      // Don't fail the request if email fails
    }

    // Log activity
    await db.logActivity({
      user_email: contractorEmail,
      user_id: contractorProfile.id,
      activity_type: 'license_submitted',
      description: `Submitted license for verification: ${licState} ${licNumber}`,
      metadata: { verification_id: verificationId }
    });

    console.log(`✓ License submission received: ${contractorEmail} - ${licState} ${licNumber}`);
    res.json({
      success: true,
      message: 'License submitted for verification',
      verificationId: verificationId,
      status: 'pending'
    });

  } catch (err) {
    console.error("❌ Error in /api/license/submit:", err);
    res.status(500).json({
      error: "Failed to submit license",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/license/verify
 * Approve or reject a license verification (called from admin email link)
 */
app.get("/api/license/verify", async (req, res) => {
  try {
    const { id, action } = req.query;

    if (!id || !action) {
      return res.status(400).send(`
        <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ Invalid Request</h1>
          <p>Missing verification ID or action</p>
        </body></html>
      `);
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).send(`
        <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ Invalid Action</h1>
          <p>Action must be 'approve' or 'reject'</p>
        </body></html>
      `);
    }

    // Find contractor by verification ID
    // For now, we'll search all contractors for this verification_id
    // In production, you'd have a license_verifications table
    const contractor = await db.getContractorByVerificationId(id);

    if (!contractor) {
      return res.status(404).send(`
        <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>❌ Not Found</h1>
          <p>Verification request not found or already processed</p>
        </body></html>
      `);
    }

    // Update license status
    const newStatus = action === 'approve' ? 'verified' : 'rejected';
    await db.updateContractorLicense({
      email: contractor.email,
      license_verified: newStatus,
      verified_at: new Date().toISOString()
    });

    // Determine contractor name with proper fallback
    let contractorName = contractor.business_name || contractor.company_name;
    if (!contractorName && (contractor.first_name || contractor.last_name)) {
      contractorName = `${contractor.first_name || ''} ${contractor.last_name || ''}`.trim();
    }
    if (!contractorName) {
      contractorName = contractor.email.split('@')[0];
    }

    // Create notification in database
    try {
      await db.createNotification({
        user_email: contractor.email,
        user_id: contractor.id,
        notification_type: action === 'approve' ? 'license_approved' : 'license_rejected',
        title: action === 'approve' ? '✅ License Verified!' : '⚠️ License Verification Update',
        message: action === 'approve'
          ? 'Your contractor license has been verified! You now have the verified badge on your profile.'
          : 'We were unable to verify your license at this time. Please review the information and resubmit if needed.',
        action_url: '/contractor-profile.html',
        read: false,
        created_at: new Date().toISOString()
      });
      console.log(`✓ Notification created for ${contractor.email}`);
    } catch (notifErr) {
      console.error('⚠️  Failed to create notification:', notifErr.message);
    }

    // Send notification email to contractor
    try {
      const subject = action === 'approve'
        ? '✅ Your License Has Been Verified!'
        : '⚠️ License Verification Update';

      // Load appropriate email template
      const templateName = action === 'approve' ? 'license-approved' : 'license-rejected';
      const template = emailService.loadTemplate(templateName);
      const html = emailService.renderTemplate(template, {
        contractorName: contractorName,
        profileLink: 'https://www.homeprohub.today/contractor-profile.html',
        jobBoardLink: 'https://www.homeprohub.today/contractor-dashboard.html',
        supportLink: 'mailto:support@homeprohub.today'
      });

      await emailService.sendEmail({
        to: contractor.email,
        subject: subject,
        html: html,
        text: action === 'approve'
          ? 'Your license has been verified! You now have the verified badge on your profile.'
          : 'We were unable to verify your license. Please review and resubmit if needed.'
      });

      console.log(`✓ Verification notification sent to ${contractor.email}`);
    } catch (emailErr) {
      console.error('⚠️  Failed to send contractor notification:', emailErr.message);
    }

    // Log activity
    await db.logActivity({
      user_email: contractor.email,
      user_id: contractor.id,
      activity_type: `license_${action}d`,
      description: `License verification ${action}d`,
      metadata: { verification_id: id }
    });

    console.log(`✓ License ${action}d for ${contractor.email}`);

    // Return success page
    res.send(`
      <html>
        <head>
          <title>Verification ${action === 'approve' ? 'Approved' : 'Rejected'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 60px 20px;
              text-align: center;
              background: ${action === 'approve' ? '#ecfdf5' : '#fef2f2'};
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: ${action === 'approve' ? '#065f46' : '#991b1b'};
              margin: 0 0 16px 0;
            }
            p {
              color: #6b7280;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${action === 'approve' ? '✅' : '❌'}</div>
            <h1>License ${action === 'approve' ? 'Approved' : 'Rejected'}</h1>
            <p><strong>${contractor.business_name || contractor.email}</strong></p>
            <p>License verification has been ${action}d.</p>
            <p>The contractor has been notified via email.</p>
          </div>
        </body>
      </html>
    `);

  } catch (err) {
    console.error("❌ Error in /api/license/verify:", err);
    res.status(500).send(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>❌ Error</h1>
        <p>Failed to process verification: ${err.message}</p>
      </body></html>
    `);
  }
});

/**
 * PUT /api/profile/update
 * Update user profile (contractor or homeowner)
 */
app.put("/api/profile/update", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const profileData = req.body;

    // Get current profile to check role
    const currentProfile = await db.getUserProfile(userEmail);
    if (!currentProfile) {
      return res.status(404).json({
        error: "Profile not found",
        code: 'NOT_FOUND'
      });
    }

    // Update profile in database
    const updatedProfile = await db.updateUserProfile(userEmail, profileData);

    console.log(`✓ Profile updated for ${userEmail}`);
    res.json({ success: true, profile: updatedProfile });

  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({
      error: "Failed to update profile",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/submit-job
 * Submit a new job posting from homeowner
 */
app.post("/api/submit-job", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const {
      title,
      description,
      address,
      zipCode,
      urgency,
      budgetLow,
      budgetHigh,
      homeownerEmail,
      originalQuestion,
      aiAnalysis
    } = req.body;

    // Validation
    if (!title || !description || !address || !zipCode || !homeownerEmail) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get or create user profile
    let homeownerProfile = await db.getUserProfile(homeownerEmail);
    if (!homeownerProfile) {
      homeownerProfile = await db.upsertUserProfile({
        email: homeownerEmail,
        role: 'homeowner',
        zip_code: zipCode,
        address: address
      });
    }

    // Create job posting
    const jobData = {
      title,
      description,
      address,
      zip_code: zipCode,
      urgency: urgency || 'flexible',
      budget_low: budgetLow,
      budget_high: budgetHigh,
      homeowner_email: homeownerEmail,
      homeowner_id: homeownerProfile.id,
      original_question: originalQuestion,
      ai_analysis: aiAnalysis,
      status: 'open'
    };

    const job = await db.createJobPosting(jobData);

    // Log activity
    await db.logActivity({
      user_email: homeownerEmail,
      user_id: homeownerProfile.id,
      activity_type: 'job_posted',
      description: `Posted job: ${title}`,
      metadata: { job_id: job.id }
    });

    console.log(`✓ Job posted: ${job.id} by ${homeownerEmail}`);
    res.json({ success: true, job });

  } catch (err) {
    console.error("❌ Error in /api/submit-job:", err);
    res.status(500).json({
      error: "Failed to submit job",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/jobs
 * Get all open jobs (optionally filter by zip code, status)
 */
app.get("/api/jobs", optionalAuth, async (req, res) => {
  try {
    const { zipCode, status, limit } = req.query;

    const filters = {};
    if (zipCode) filters.zipCode = zipCode;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const jobs = await db.getJobs(filters);

    console.log(`✓ Retrieved ${jobs.length} jobs`);
    res.json({ jobs });

  } catch (err) {
    console.error("❌ Error in /api/jobs:", err);
    res.status(500).json({
      error: "Failed to retrieve jobs",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/jobs
 * Create a new job posting (modern endpoint matching frontend)
 */
app.post("/api/jobs", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      budget_low,
      budget_high,
      zip_code,
      urgency,
      ai_assisted,
      homeowner_email,
      original_question,
      ai_analysis
    } = req.body;

    // Validation
    if (!title || !description || !zip_code || !homeowner_email) {
      return res.status(400).json({
        error: "Missing required fields: title, description, zip_code, homeowner_email",
        code: 'VALIDATION_ERROR'
      });
    }

    if (!isValidZip(zip_code)) {
      return res.status(400).json({
        error: "Invalid ZIP code format",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get or create user profile
    let homeownerProfile = await db.getUserProfile(homeowner_email);
    if (!homeownerProfile) {
      homeownerProfile = await db.upsertUserProfile({
        email: homeowner_email,
        role: 'homeowner',
        zip_code: zip_code
      });
    }

    // Create job posting
    const jobData = {
      title: sanitizeInput(title, 200),
      description: sanitizeInput(description, 5000),
      category: category || 'general',
      address: `ZIP: ${zip_code}`, // Use ZIP as placeholder for address
      zip_code: zip_code,
      budget_low: budget_low || null,
      budget_high: budget_high || null,
      urgency: urgency || 'flexible',
      status: 'open',
      homeowner_email: homeowner_email,
      homeowner_id: homeownerProfile.id,
      original_question: original_question || null,
      ai_analysis: ai_analysis || null
    };

    const job = await db.createJobPosting(jobData);

    // Create notification (optional - could notify nearby contractors)
    await db.createNotification({
      user_email: homeowner_email,
      user_id: homeownerProfile.id,
      notification_type: 'new_job',
      title: 'Job Posted Successfully',
      message: `Your job "${title}" has been posted and is now visible to contractors.`,
      job_id: job.id,
      action_url: `/homeowner-dashboard.html`
    });

    // Send job posting confirmation email
    try {
      await emailService.sendJobPostingConfirmation({
        homeownerEmail: homeowner_email,
        homeownerName: homeownerProfile.full_name || homeownerProfile.email.split('@')[0],
        job: job
      });
      console.log(`✓ Job posting confirmation email sent to ${homeowner_email}`);
    } catch (emailErr) {
      console.error('⚠️  Failed to send job posting confirmation email:', emailErr.message);
      // Don't fail the request if email fails
    }

    console.log(`✓ Job posted: ${job.id} by ${homeowner_email}${ai_assisted ? ' (AI-assisted)' : ''}`);
    res.json({ success: true, job });

  } catch (err) {
    console.error("❌ Error in POST /api/jobs:", err);
    res.status(500).json({
      error: "Failed to create job",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/jobs/:jobId
 * Get a specific job with all bids
 */
app.get("/api/jobs/:jobId", optionalAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await db.getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        code: 'NOT_FOUND'
      });
    }

    // Increment view count
    await db.incrementJobViews(jobId);

    console.log(`✓ Retrieved job: ${jobId}`);
    res.json({ job });

  } catch (err) {
    console.error("❌ Error in /api/jobs/:jobId:", err);
    res.status(500).json({
      error: "Failed to retrieve job",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/homeowner/jobs
 * Get all jobs posted by a homeowner
 */
app.get("/api/homeowner/jobs", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const jobs = await db.getJobsByHomeowner(email);

    console.log(`✓ Retrieved ${jobs.length} jobs for homeowner: ${email}`);
    res.json({ jobs });

  } catch (err) {
    console.error("❌ Error in /api/homeowner/jobs:", err);
    res.status(500).json({
      error: "Failed to retrieve jobs",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/project/complete
 * Mark a project as completed and submit a review
 */
app.post("/api/project/complete", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const {
      projectId,
      rating,
      positiveTags,
      negativeTags,
      photos,
      reviewText,
      homeownerEmail
    } = req.body;

    // Validation
    if (!projectId || !rating || !homeownerEmail) {
      return res.status(400).json({
        error: "Missing required fields (projectId, rating, homeownerEmail)",
        code: 'VALIDATION_ERROR'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get the project to find the contractor
    const project = await db.getJobById(projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        code: 'NOT_FOUND'
      });
    }

    // Verify homeowner owns this project
    if (project.homeowner_email !== homeownerEmail) {
      return res.status(403).json({
        error: "Unauthorized: You can only complete your own projects",
        code: 'FORBIDDEN'
      });
    }

    // Find the accepted bid to get contractor email
    const acceptedBid = project.bids?.find(b => b.status === 'accepted');
    if (!acceptedBid) {
      return res.status(400).json({
        error: "No accepted bid found for this project",
        code: 'VALIDATION_ERROR'
      });
    }

    const contractorEmail = acceptedBid.contractor_email;

    // Create the review
    const review = await db.createReview({
      projectId,
      homeownerEmail,
      contractorEmail,
      rating,
      positiveTags: positiveTags || [],
      negativeTags: negativeTags || [],
      reviewText: reviewText || '',
      photos: photos || []
    });

    // Update project status to completed
    const completedAt = new Date().toISOString();
    await db.updateJobStatus(projectId, 'completed', completedAt);

    // Update homeowner's grade (add 10 points for completing a review)
    const homeownerProfile = await db.getUserProfile(homeownerEmail);
    if (homeownerProfile) {
      const currentGrade = homeownerProfile.homeowner_grade || 0;
      await db.updateUserProfile(homeownerEmail, {
        homeowner_grade: currentGrade + 10
      });
    }

    console.log(`✓ Project ${projectId} marked as completed with review by ${homeownerEmail}`);
    res.json({
      success: true,
      review,
      message: 'Project completed and review submitted successfully'
    });

  } catch (err) {
    console.error("❌ Error in /api/project/complete:", err);
    res.status(500).json({
      error: "Failed to complete project and submit review",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/project/:id
 * Update project details
 */
app.put("/api/project/:id", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, description, address, zip_code, urgency } = req.body;

    // Validation
    if (!title || !description || !address || !zip_code) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get the project to verify ownership
    const project = await db.getJobById(projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        code: 'NOT_FOUND'
      });
    }

    // Update the project
    const { data, error } = await db.supabase
      .from('job_postings')
      .update({
        title,
        description,
        address,
        zip_code,
        urgency: urgency || 'flexible',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✓ Project ${projectId} updated successfully`);
    res.json({
      success: true,
      project: data,
      message: 'Project updated successfully'
    });

  } catch (err) {
    console.error("❌ Error in PUT /api/project/:id:", err);
    res.status(500).json({
      error: "Failed to update project",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/project/:id/cancel
 * Cancel a project
 */
app.put("/api/project/:id/cancel", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const projectId = req.params.id;

    // Get the project to verify it exists
    const project = await db.getJobById(projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        code: 'NOT_FOUND'
      });
    }

    // Update project status to cancelled
    await db.updateJobStatus(projectId, 'cancelled');

    console.log(`✓ Project ${projectId} cancelled`);
    res.json({
      success: true,
      message: 'Project cancelled successfully'
    });

  } catch (err) {
    console.error("❌ Error in PUT /api/project/:id/cancel:", err);
    res.status(500).json({
      error: "Failed to cancel project",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/submit-bid
 * Submit a contractor bid on a job
 */
app.post("/api/submit-bid", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const {
      jobId,
      contractorEmail,
      bidAmountLow,
      bidAmountHigh,
      estimatedDuration,
      startAvailability,
      message,
      estimate
    } = req.body;

    // Validation
    if (!jobId || !contractorEmail || !bidAmountLow || !bidAmountHigh) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get contractor profile (or create if doesn't exist)
    let contractorProfile = await db.getUserProfile(contractorEmail);
    if (!contractorProfile) {
      // Auto-create basic profile
      contractorProfile = await db.upsertUserProfile({
        email: contractorEmail,
        role: 'contractor',
        profile_complete: false
      });
    }

    // Determine contractor display name with proper fallback
    let contractorName = contractorProfile.business_name || contractorProfile.company_name;
    if (!contractorName && (contractorProfile.first_name || contractorProfile.last_name)) {
      contractorName = `${contractorProfile.first_name || ''} ${contractorProfile.last_name || ''}`.trim();
    }
    if (!contractorName) {
      contractorName = contractorEmail.split('@')[0];
    }

    // Create bid
    const bidData = {
      job_id: jobId,
      contractor_email: contractorEmail,
      contractor_id: contractorProfile.id,
      contractor_business_name: contractorName,
      bid_amount_low: bidAmountLow,
      bid_amount_high: bidAmountHigh,
      estimated_duration: estimatedDuration,
      start_availability: startAvailability,
      message: message,
      status: 'pending'
    };

    // Include estimate data if provided
    if (estimate) {
      bidData.estimate = estimate;
      bidData.has_estimate = true;
      console.log('✓ Estimate data included with bid submission');
    }

    console.log('📝 Checking for existing bid...');
    let bid;
    try {
      // Check if bid already exists for this contractor on this job
      const existingBids = await db.getBidsByContractor(contractorEmail);
      const duplicateBid = existingBids.find(b => b.job_id === jobId);

      if (duplicateBid) {
        // Update existing bid instead of creating new one
        console.log(`⚠️  Bid already exists for this job, updating instead: ${duplicateBid.id}`);

        const updateData = {
          bid_amount_low: bidAmountLow,
          bid_amount_high: bidAmountHigh,
          estimated_duration: estimatedDuration,
          start_availability: startAvailability,
          message: message,
          updated_at: new Date().toISOString()
        };

        if (estimate) {
          updateData.estimate = estimate;
          updateData.has_estimate = true;
        }

        const { data, error } = await db.supabase
          .from('contractor_bids')
          .update(updateData)
          .eq('id', duplicateBid.id)
          .select()
          .single();

        if (error) throw error;
        bid = data;
        console.log('✓ Bid updated successfully:', bid.id);
      } else {
        // Create new bid
        console.log('📝 Creating new bid...');
        bid = await db.submitBid(bidData);
        console.log('✓ Bid inserted into database:', bid.id);
      }
    } catch (bidErr) {
      console.error('❌ Error inserting/updating bid:', bidErr);
      throw new Error(`Bid operation failed: ${bidErr.message}`);
    }

    // Get job details for notification
    console.log('📋 Fetching job details for notifications...');
    const job = await db.getJobById(jobId);

    // Create notification for homeowner
    console.log('🔔 Creating notification for homeowner...');
    try {
      await db.createNotification({
        user_email: job.homeowner_email,
        user_id: job.homeowner_id,
        notification_type: 'new_bid',
        title: 'New Bid Received',
        message: `${contractorProfile.business_name || contractorProfile.email} submitted a bid on your job "${job.title}"`,
        job_id: jobId,
        bid_id: bid.id,
        action_url: `/homeowner-dashboard.html?job=${jobId}`
      });
      console.log('✓ Notification created');
    } catch (notifErr) {
      console.error('⚠️  Failed to create notification (non-fatal):', notifErr.message);
      // Don't fail if notification creation fails
    }

    // Send bid notification email to homeowner
    try {
      const homeownerProfile = await db.getUserProfile(job.homeowner_email);
      if (typeof emailService !== 'undefined' && emailService.sendBidNotification) {
        await emailService.sendBidNotification({
          homeownerEmail: job.homeowner_email,
          homeownerName: homeownerProfile?.full_name || job.homeowner_email.split('@')[0],
          contractor: contractorProfile,
          job: job,
          bid: bid
        });
        console.log(`✓ Bid notification email sent to ${job.homeowner_email}`);
      } else {
        console.log('⚠️  Email service not configured, skipping email notification');
      }
    } catch (emailErr) {
      console.error('⚠️  Failed to send bid notification email:', emailErr.message);
      // Don't fail the request if email fails
    }

    // Log activity
    console.log('📊 Logging activity...');
    try {
      await db.logActivity({
        user_email: contractorEmail,
        user_id: contractorProfile.id,
        activity_type: 'bid_submitted',
        description: `Submitted bid on job: ${job.title}`,
        metadata: { job_id: jobId, bid_id: bid.id }
      });
      console.log('✓ Activity logged');
    } catch (activityErr) {
      console.error('⚠️  Failed to log activity (non-fatal):', activityErr.message);
      // Don't fail if activity logging fails
    }

    console.log(`✓ Bid submitted successfully: ${bid.id} by ${contractorEmail} on job ${jobId}`);
    res.json({ success: true, bid });

  } catch (err) {
    console.error("❌ Error in /api/submit-bid:", err);
    res.status(500).json({
      error: "Failed to submit bid",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractor/bids
 * Get all bids submitted by a contractor
 */
app.get("/api/contractor/bids", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const bids = await db.getBidsByContractor(email);

    console.log(`✓ Retrieved ${bids.length} bids for contractor: ${email}`);
    res.json({ bids });

  } catch (err) {
    console.error("❌ Error in /api/contractor/bids:", err);
    res.status(500).json({
      error: "Failed to retrieve bids",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/bid/accept
 * Homeowner accepts a bid
 */
app.post("/api/bid/accept", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const { bidId, jobId, homeownerEmail } = req.body;

    if (!bidId || !jobId || !homeownerEmail) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify job belongs to homeowner
    const job = await db.getJobById(jobId);
    if (job.homeowner_email !== homeownerEmail) {
      return res.status(403).json({
        error: "Unauthorized",
        code: 'UNAUTHORIZED'
      });
    }

    // Accept bid (this also rejects other bids and updates job status)
    const acceptedBid = await db.acceptBid(bidId, jobId);

    // Get contractor details
    const contractor = await db.getUserProfile(acceptedBid.contractor_email);

    // Create notification for contractor
    await db.createNotification({
      user_email: acceptedBid.contractor_email,
      user_id: contractor.id,
      notification_type: 'bid_accepted',
      title: 'Bid Accepted!',
      message: `Your bid on "${job.title}" has been accepted!`,
      job_id: jobId,
      bid_id: bidId,
      action_url: `/contractor-dashboard.html?job=${jobId}`
    });

    // Notify other contractors that their bids were rejected
    const allBids = await db.getBidsByJob(jobId);
    for (const bid of allBids) {
      if (bid.id !== bidId && bid.status === 'rejected') {
        const otherContractor = await db.getUserProfile(bid.contractor_email);
        await db.createNotification({
          user_email: bid.contractor_email,
          user_id: otherContractor.id,
          notification_type: 'bid_rejected',
          title: 'Bid Not Selected',
          message: `Your bid on "${job.title}" was not selected`,
          job_id: jobId,
          bid_id: bid.id
        });
      }
    }

    console.log(`✓ Bid accepted: ${bidId} for job ${jobId}`);
    res.json({ success: true, bid: acceptedBid });

  } catch (err) {
    console.error("❌ Error in /api/bid/accept:", err);
    res.status(500).json({
      error: "Failed to accept bid",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/bid/decline
 * Homeowner declines a bid
 */
app.post("/api/bid/decline", requireAuth, requireRole('homeowner'), async (req, res) => {
  try {
    const { bidId, jobId, homeownerEmail } = req.body;

    if (!bidId || !jobId || !homeownerEmail) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify job belongs to homeowner
    const job = await db.getJobById(jobId);
    if (job.homeowner_email !== homeownerEmail) {
      return res.status(403).json({
        error: "Unauthorized",
        code: 'UNAUTHORIZED'
      });
    }

    // Update bid status to declined
    const { data, error } = await db.supabase
      .from('contractor_bids')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString()
      })
      .eq('id', bidId)
      .select()
      .single();

    if (error) throw error;

    // Get contractor details
    const contractor = await db.getUserProfile(data.contractor_email);

    // Create notification for contractor
    await db.createNotification({
      user_email: data.contractor_email,
      user_id: contractor.id,
      notification_type: 'bid_rejected',
      title: 'Bid Declined',
      message: `Your bid on "${job.title}" has been declined`,
      job_id: jobId,
      bid_id: bidId
    });

    console.log(`✓ Bid declined: ${bidId} for job ${jobId}`);
    res.json({ success: true, bid: data });

  } catch (err) {
    console.error("❌ Error in /api/bid/decline:", err);
    res.status(500).json({
      error: "Failed to decline bid",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// ========================================
// LICENSE MANAGEMENT API ENDPOINTS
// ========================================

/**
 * POST /api/contractor/licenses
 * Add or update contractor license
 */
app.post("/api/contractor/licenses", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const {
      contractorEmail,
      tradeType,
      licenseNumber,
      state,
      issueDate,
      expirationDate,
      documentUrl
    } = req.body;

    // Validation
    if (!contractorEmail || !tradeType || !licenseNumber || !state) {
      return res.status(400).json({
        error: "Missing required fields: contractorEmail, tradeType, licenseNumber, state",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get contractor profile to link contractor_id
    const contractor = await db.getUserProfile(contractorEmail);
    if (!contractor) {
      return res.status(404).json({
        error: "Contractor profile not found",
        code: 'NOT_FOUND'
      });
    }

    const licenseData = {
      contractor_email: contractorEmail,
      contractor_id: contractor.id,
      trade_type: tradeType,
      license_number: licenseNumber.trim(),
      state: state.toUpperCase(),
      issue_date: issueDate || null,
      expiration_date: expirationDate || null,
      license_document_url: documentUrl || null,
      verification_status: 'pending'
    };

    const license = await db.addContractorLicense(licenseData);

    console.log(`✓ License added/updated: ${tradeType} for ${contractorEmail}`);
    res.json({ success: true, license });

  } catch (err) {
    console.error("❌ Error in /api/contractor/licenses:", err);
    res.status(500).json({
      error: "Failed to add license",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractor/licenses
 * Get all licenses for a contractor
 */
app.get("/api/contractor/licenses", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const { contractorEmail } = req.query;

    if (!contractorEmail) {
      return res.status(400).json({
        error: "Missing required parameter: contractorEmail",
        code: 'VALIDATION_ERROR'
      });
    }

    const licenses = await db.getContractorLicenses(contractorEmail);

    res.json({ success: true, licenses });

  } catch (err) {
    console.error("❌ Error in GET /api/contractor/licenses:", err);
    res.status(500).json({
      error: "Failed to fetch licenses",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractor/licenses/check
 * Check if contractor has required license for a job
 */
app.get("/api/contractor/licenses/check", optionalAuth, async (req, res) => {
  try {
    const { contractorEmail, category, state } = req.query;

    if (!contractorEmail || !category || !state) {
      return res.status(400).json({
        error: "Missing required parameters: contractorEmail, category, state",
        code: 'VALIDATION_ERROR'
      });
    }

    const licenseCheck = await db.checkContractorLicenseForJob(
      contractorEmail,
      category,
      state.toUpperCase()
    );

    // Get license requirements from JSON
    let requirementInfo = null;
    if (licenseRequirements && licenseRequirements.states[state.toUpperCase()]) {
      const stateData = licenseRequirements.states[state.toUpperCase()];
      requirementInfo = stateData[licenseCheck.tradeType] || null;
    }

    res.json({
      success: true,
      ...licenseCheck,
      requirementInfo
    });

  } catch (err) {
    console.error("❌ Error in /api/contractor/licenses/check:", err);
    res.status(500).json({
      error: "Failed to check license",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractor/recent-jobs
 * Get recent job opportunities for contractor dashboard
 */
app.get("/api/contractor/recent-jobs", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const contractorEmail = req.user.email;

    // Get contractor profile to check their location and trade
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('trade, city, state, zip_code')
      .eq('email', contractorEmail)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Fetch recent active job postings
    let query = supabase
      .from('job_postings')
      .select(`
        id,
        title,
        description,
        category,
        urgency,
        budget_low,
        budget_high,
        city,
        state,
        zip_code,
        created_at,
        homeowner_email
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Filter by contractor's trade if specified
    if (profile.trade) {
      query = query.eq('category', profile.trade);
    }

    // Filter by contractor's state if specified
    if (profile.state) {
      query = query.eq('state', profile.state);
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      throw jobsError;
    }

    // Get homeowner grades for each job
    const jobsWithGrades = await Promise.all(jobs.map(async (job) => {
      const { data: homeownerProfile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('email', job.homeowner_email)
        .single();

      // TODO: Implement homeowner grading
      const homeowner_grade = 'A'; // Placeholder

      return {
        ...job,
        homeowner_name: homeownerProfile?.name || 'Homeowner',
        homeowner_grade
      };
    }));

    res.json({
      success: true,
      jobs: jobsWithGrades
    });

  } catch (err) {
    console.error("❌ Error in /api/contractor/recent-jobs:", err);
    res.status(500).json({
      error: "Failed to fetch recent jobs",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/contractor/update-subscription
 * Update contractor subscription tier
 */
app.post("/api/contractor/update-subscription", requireAuth, requireRole('contractor'), async (req, res) => {
  try {
    const { tier } = req.body;
    const contractorEmail = req.user.email;

    // Validate tier
    const validTiers = ['starter', 'pro', 'premium'];
    if (!tier || !validTiers.includes(tier.toLowerCase())) {
      return res.status(400).json({
        error: "Invalid tier. Must be one of: starter, pro, premium",
        code: 'VALIDATION_ERROR'
      });
    }

    // Update user profile with new subscription tier
    const { data: profile, error: updateError } = await supabase
      .from('user_profiles')
      .update({ subscription_tier: tier.toLowerCase() })
      .eq('email', contractorEmail)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating subscription:", updateError);
      throw updateError;
    }

    console.log(`✓ Subscription updated: ${contractorEmail} -> ${tier}`);
    res.json({
      success: true,
      subscription_tier: tier.toLowerCase(),
      message: `Successfully updated to ${tier} plan`
    });

  } catch (err) {
    console.error("❌ Error in /api/contractor/update-subscription:", err);
    res.status(500).json({
      error: "Failed to update subscription",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/contractor/licenses/:id/verify
 * Update license verification status (admin only)
 */
app.put("/api/contractor/licenses/:id/verify", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verifiedBy, rejectionReason } = req.body;

    // Validation
    if (!id || !status || !verifiedBy) {
      return res.status(400).json({
        error: "Missing required fields: status, verifiedBy",
        code: 'VALIDATION_ERROR'
      });
    }

    if (!['verified', 'rejected', 'expired'].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be: verified, rejected, or expired",
        code: 'VALIDATION_ERROR'
      });
    }

    const license = await db.updateLicenseVerificationStatus(
      id,
      status,
      verifiedBy,
      rejectionReason
    );

    console.log(`✓ License ${status}: ${id} by ${verifiedBy}`);
    res.json({ success: true, license });

  } catch (err) {
    console.error("❌ Error in /api/contractor/licenses/:id/verify:", err);
    res.status(500).json({
      error: "Failed to update license status",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/license-requirements/:state
 * Get license requirements for a specific state
 */
app.get("/api/license-requirements/:state", (req, res) => {
  try {
    const { state } = req.params;

    if (!licenseRequirements) {
      return res.status(503).json({
        error: "License requirements data not available",
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const stateCode = state.toUpperCase();
    const stateData = licenseRequirements.states[stateCode];

    if (!stateData) {
      return res.status(404).json({
        error: `License requirements not found for state: ${stateCode}`,
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      state: stateCode,
      stateName: stateData.name,
      requirements: stateData,
      educationPartners: licenseRequirements.education_partners,
      verificationStatuses: licenseRequirements.verification_statuses
    });

  } catch (err) {
    console.error("❌ Error in /api/license-requirements/:state:", err);
    res.status(500).json({
      error: "Failed to fetch license requirements",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/submit-homeowner-rating
 * Submit a rating for a homeowner
 */
app.post("/api/submit-homeowner-rating", async (req, res) => {
  try {
    const {
      homeownerContact,
      projectAddress,
      jobId,
      contractorEmail,
      communicationRating,
      decisionSpeedRating,
      paymentRating,
      projectComplexity,
      comments
    } = req.body;

    // Validation
    if (!homeownerContact || !contractorEmail || !communicationRating || !decisionSpeedRating || !paymentRating) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get contractor profile
    const contractor = await db.getUserProfile(contractorEmail);
    if (!contractor) {
      return res.status(400).json({
        error: "Contractor profile not found",
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Get homeowner profile if exists
    const homeowner = await db.getUserProfile(homeownerContact);

    // Create rating
    const ratingData = {
      homeowner_contact: homeownerContact,
      homeowner_id: homeowner?.id,
      project_address: projectAddress,
      job_id: jobId,
      contractor_email: contractorEmail,
      contractor_id: contractor.id,
      communication_rating: parseInt(communicationRating),
      decision_speed_rating: parseInt(decisionSpeedRating),
      payment_rating: parseInt(paymentRating),
      project_complexity: projectComplexity,
      comments: comments
    };

    const rating = await db.submitHomeownerRating(ratingData);

    // Log activity
    await db.logActivity({
      user_email: contractorEmail,
      user_id: contractor.id,
      activity_type: 'rating_submitted',
      description: `Rated homeowner: ${homeownerContact}`,
      metadata: { rating_id: rating.id }
    });

    console.log(`✓ Homeowner rating submitted: ${rating.id}`);
    res.json({ success: true, rating });

  } catch (err) {
    console.error("❌ Error in /api/submit-homeowner-rating:", err);
    res.status(500).json({
      error: "Failed to submit rating",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/homeowner-rating/:contact
 * Get aggregated rating for a homeowner
 */
app.get("/api/homeowner-rating/:contact", async (req, res) => {
  try {
    const { contact } = req.params;
    const rating = await db.getHomeownerRating(contact);

    if (!rating) {
      return res.json({
        homeowner_contact: contact,
        total_ratings: 0,
        message: "No ratings found for this homeowner"
      });
    }

    console.log(`✓ Retrieved rating for homeowner: ${contact}`);
    res.json({ rating });

  } catch (err) {
    console.error("❌ Error in /api/homeowner-rating/:contact:", err);
    res.status(500).json({
      error: "Failed to retrieve rating",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/top-rated-homeowners
 * Get list of top rated homeowners for directory
 */
app.get("/api/top-rated-homeowners", async (req, res) => {
  try {
    const { limit } = req.query;
    const homeowners = await db.getTopRatedHomeowners(limit ? parseInt(limit) : 50);

    console.log(`✓ Retrieved ${homeowners.length} top rated homeowners`);
    res.json({ homeowners });

  } catch (err) {
    console.error("❌ Error in /api/top-rated-homeowners:", err);
    res.status(500).json({
      error: "Failed to retrieve homeowners",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/messages/send
 * Send a message - supports both conversation-based and legacy thread-based messaging
 */
app.post("/api/messages/send", requireAuth, async (req, res) => {
  try {
    const {
      // New conversation-based format
      conversation_id,
      sender_email,
      recipient_email,
      message,

      // Legacy thread-based format
      jobId,
      threadId,
      senderEmail,
      recipientEmail,
      messageText,
      attachments
    } = req.body;

    // Check if this is new conversation-based format
    if (conversation_id) {
      // New conversation-based messaging
      if (!sender_email || !recipient_email || !message) {
        return res.status(400).json({
          error: "Missing required fields: sender_email, recipient_email, message",
          code: 'VALIDATION_ERROR'
        });
      }

      const sanitizedMessage = sanitizeInput(message, 5000);

      const sentMessage = await db.sendConversationMessage({
        conversation_id,
        sender_email,
        recipient_email,
        message: sanitizedMessage,
        attachments: req.body.attachments || []
      });

      console.log(`✓ Message sent in conversation: ${conversation_id}${req.body.attachments && req.body.attachments.length > 0 ? ' with ' + req.body.attachments.length + ' attachment(s)' : ''}`);
      return res.json({ success: true, message: sentMessage });
    }

    // Legacy thread-based messaging
    if (!senderEmail || !recipientEmail || !messageText) {
      return res.status(400).json({
        error: "Missing required fields",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get user profiles
    const sender = await db.getUserProfile(senderEmail);
    const recipient = await db.getUserProfile(recipientEmail);

    if (!sender || !recipient) {
      return res.status(400).json({
        error: "User profile not found",
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Create message
    const messageData = {
      job_id: jobId,
      thread_id: threadId || jobId, // Use jobId as threadId if not provided
      sender_email: senderEmail,
      sender_id: sender.id,
      recipient_email: recipientEmail,
      recipient_id: recipient.id,
      message_text: messageText,
      attachments: attachments || []
    };

    const sentMessage = await db.sendMessage(messageData);

    // Create notification for recipient
    await db.createNotification({
      user_email: recipientEmail,
      user_id: recipient.id,
      notification_type: 'new_message',
      title: 'New Message',
      message: `${sender.business_name || sender.first_name || senderEmail} sent you a message`,
      message_id: sentMessage.id,
      job_id: jobId,
      action_url: `/messages.html?thread=${threadId || jobId}`
    });

    console.log(`✓ Message sent: ${sentMessage.id}`);
    res.json({ success: true, message: sentMessage });

  } catch (err) {
    console.error("❌ Error in /api/messages/send:", err);
    res.status(500).json({
      error: "Failed to send message",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/messages/thread/:threadId
 * Get all messages in a thread
 */
app.get("/api/messages/thread/:threadId", requireAuth, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { userEmail } = req.query;

    const messages = await db.getMessagesByThread(threadId);

    // Mark messages as read if userEmail provided
    if (userEmail) {
      await db.markMessagesAsRead(threadId, userEmail);
    }

    console.log(`✓ Retrieved ${messages.length} messages for thread: ${threadId}`);
    res.json({ messages });

  } catch (err) {
    console.error("❌ Error in /api/messages/thread/:threadId:", err);
    res.status(500).json({
      error: "Failed to retrieve messages",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/messages/conversations
 * Get all conversations for a user
 */
app.get("/api/messages/conversations", requireAuth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const conversations = await db.getUserConversations(email);

    console.log(`✓ Retrieved ${conversations.length} conversations for: ${email}`);
    res.json({ conversations });

  } catch (err) {
    console.error("❌ Error in /api/messages/conversations:", err);
    res.status(500).json({
      error: "Failed to retrieve conversations",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// ========================================
// CONVERSATION-BASED MESSAGING API
// ========================================

/**
 * POST /api/conversations/create
 * Create or find an existing conversation between homeowner and contractor for a job
 */
app.post("/api/conversations/create", requireAuth, async (req, res) => {
  try {
    const { job_id, homeowner_email, contractor_email } = req.body;

    // Validation
    if (!job_id || !homeowner_email || !contractor_email) {
      return res.status(400).json({
        error: "Missing required fields: job_id, homeowner_email, contractor_email",
        code: 'VALIDATION_ERROR'
      });
    }

    const conversation = await db.createOrFindConversation(
      job_id,
      homeowner_email,
      contractor_email
    );

    console.log(`✓ Conversation created/found: ${conversation.id}`);
    res.json({ success: true, conversation });

  } catch (err) {
    console.error("❌ Error in /api/conversations/create:", err);
    res.status(500).json({
      error: "Failed to create conversation",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/conversations
 * Get all conversations for a user with details
 */
app.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const conversations = await db.getConversationsForUser(email);

    console.log(`✓ Retrieved ${conversations.length} conversations for: ${email}`);
    res.json({ conversations });

  } catch (err) {
    console.error("❌ Error in /api/conversations:", err);
    res.status(500).json({
      error: "Failed to retrieve conversations",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/messages/unread
 * Get unread message count only (for navigation)
 * IMPORTANT: Must be defined BEFORE /api/messages/:conversationId
 */
app.get("/api/messages/unread", requireAuth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const count = await db.getUnreadCount(email);

    res.json({ count });

  } catch (err) {
    console.error("❌ Error in /api/messages/unread:", err);
    res.status(500).json({
      error: "Failed to retrieve unread message count",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/messages/:conversationId
 * Get all messages for a specific conversation
 */
app.get("/api/messages/:conversationId", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { email } = req.query;

    const messages = await db.getConversationMessages(conversationId);

    // Mark messages as read if user email provided
    if (email) {
      await db.markConversationAsRead(conversationId, email);
    }

    console.log(`✓ Retrieved ${messages.length} messages for conversation: ${conversationId}`);
    res.json({ messages });

  } catch (err) {
    console.error("❌ Error in /api/messages/:conversationId:", err);
    res.status(500).json({
      error: "Failed to retrieve messages",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/messages/send
 * Send a message in a conversation
 */
app.post("/api/messages/send-conversation", requireAuth, async (req, res) => {
  try {
    const {
      conversation_id,
      sender_email,
      recipient_email,
      message
    } = req.body;

    // Validation
    if (!conversation_id || !sender_email || !recipient_email || !message) {
      return res.status(400).json({
        error: "Missing required fields: conversation_id, sender_email, recipient_email, message",
        code: 'VALIDATION_ERROR'
      });
    }

    // Sanitize message
    const sanitizedMessage = sanitizeInput(message, 5000);

    const sentMessage = await db.sendConversationMessage({
      conversation_id,
      sender_email,
      recipient_email,
      message: sanitizedMessage
    });

    console.log(`✓ Message sent in conversation: ${conversation_id}`);
    res.json({ success: true, message: sentMessage });

  } catch (err) {
    console.error("❌ Error in /api/messages/send-conversation:", err);
    res.status(500).json({
      error: "Failed to send message",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/conversations/:conversationId/read
 * Mark all messages in a conversation as read for a user
 */
app.post("/api/conversations/:conversationId/read", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email required in request body",
        code: 'VALIDATION_ERROR'
      });
    }

    await db.markConversationAsRead(conversationId, email);

    console.log(`✓ Marked conversation ${conversationId} as read for: ${email}`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Error in /api/conversations/:conversationId/read:", err);
    res.status(500).json({
      error: "Failed to mark conversation as read",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/notifications
 * Get notifications for a user
 */
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const { email, limit } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const notifications = await db.getNotifications(email, limit ? parseInt(limit) : 50);
    const unreadCount = await db.getUnreadNotificationCount(email);

    console.log(`✓ Retrieved ${notifications.length} notifications for: ${email}`);
    res.json({ notifications, unreadCount });

  } catch (err) {
    console.error("❌ Error in /api/notifications:", err);
    res.status(500).json({
      error: "Failed to retrieve notifications",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/notifications/read
 * Mark a notification as read
 */
app.post("/api/notifications/read", async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: "Notification ID required",
        code: 'VALIDATION_ERROR'
      });
    }

    await db.markNotificationAsRead(notificationId);

    console.log(`✓ Notification marked as read: ${notificationId}`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Error in /api/notifications/read:", err);
    res.status(500).json({
      error: "Failed to mark notification as read",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/unread-count
 * Get unread message and notification counts
 */
app.get("/api/unread-count", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const messageCount = await db.getUnreadCount(email);
    const notificationCount = await db.getUnreadNotificationCount(email);

    res.json({
      messages: messageCount,
      notifications: notificationCount,
      total: messageCount + notificationCount
    });

  } catch (err) {
    console.error("❌ Error in /api/unread-count:", err);
    res.status(500).json({
      error: "Failed to retrieve unread counts",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notification count only (for navigation)
 */
app.get("/api/notifications/unread", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Email parameter required",
        code: 'VALIDATION_ERROR'
      });
    }

    const count = await db.getUnreadNotificationCount(email);

    res.json({ count });

  } catch (err) {
    console.error("❌ Error in /api/notifications/unread:", err);
    res.status(500).json({
      error: "Failed to retrieve unread notification count",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark a specific notification as read (REST-style)
 */
app.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Notification ID required",
        code: 'VALIDATION_ERROR'
      });
    }

    await db.markNotificationAsRead(id);

    console.log(`✓ Notification marked as read: ${id}`);
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Error in /api/notifications/:id/read:", err);
    res.status(500).json({
      error: "Failed to mark notification as read",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for a user
 */
app.post("/api/notifications/mark-all-read", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email required",
        code: 'VALIDATION_ERROR'
      });
    }

    // Get all unread notifications for this user
    const { data: notifications, error } = await db.supabase
      .from('notifications')
      .select('id')
      .eq('user_email', email)
      .eq('read', false);

    if (error) throw error;

    // Mark them all as read
    if (notifications && notifications.length > 0) {
      const { error: updateError } = await db.supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_email', email)
        .eq('read', false);

      if (updateError) throw updateError;

      console.log(`✓ Marked ${notifications.length} notifications as read for: ${email}`);
    }

    res.json({ success: true, count: notifications?.length || 0 });

  } catch (err) {
    console.error("❌ Error in /api/notifications/mark-all-read:", err);
    res.status(500).json({
      error: "Failed to mark all notifications as read",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// ========================================
// CONTRACTOR DIRECTORY & GRADING
// ========================================

/**
 * GET /api/contractors/directory
 * Get contractor directory with search and filters
 * Query params: trade, minGrade, maxDistance, searchTerm, zip, limit, offset
 */
app.get("/api/contractors/directory", optionalAuth, async (req, res) => {
  try {
    const {
      trade,
      minGrade,
      maxDistance,
      searchTerm,
      zip,
      limit = 50,
      offset = 0
    } = req.query;

    // Build query
    let query = supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        company_name,
        business_name,
        full_name,
        trade,
        years_in_business,
        city,
        state,
        zip_code,
        phone,
        profile_complete,
        instagram_url,
        facebook_url,
        youtube_url
      `)
      .eq('role', 'contractor')
      .eq('profile_complete', true)
      .order('created_at', { ascending: false });

    // Filter by trade
    if (trade && trade !== 'all') {
      query = query.eq('trade', trade);
    }

    // Search by name or trade
    if (searchTerm) {
      query = query.or(`company_name.ilike.%${searchTerm}%,business_name.ilike.%${searchTerm}%,trade.ilike.%${searchTerm}%`);
    }

    // Filter by zip code (location)
    if (zip) {
      query = query.eq('zip_code', zip);
    }

    // Apply pagination
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: contractors, error } = await query;

    if (error) throw error;

    // Enrich contractors with grade, license status, and reviews
    const enrichedContractors = await Promise.all(
      contractors.map(async (contractor) => {
        // Get grade
        const gradeResult = await supabase.rpc('calculate_contractor_grade', {
          p_contractor_email: contractor.email
        });

        const grade = gradeResult.data || {
          grade: 'N/A',
          score: 0,
          color: '#6b7280'
        };

        // Get license status
        const { data: licenses } = await supabase
          .from('contractor_licenses')
          .select('verification_status, trade_type, state')
          .eq('contractor_email', contractor.email)
          .eq('verification_status', 'verified')
          .order('verified_at', { ascending: false })
          .limit(1);

        // Get review count and average
        const { data: ratings } = await supabase
          .from('contractor_ratings')
          .select('quality_rating, communication_rating, timeliness_rating, professionalism_rating, value_rating')
          .eq('contractor_email', contractor.email);

        const reviewCount = ratings?.length || 0;
        let averageRating = 0;

        if (reviewCount > 0) {
          const totalRating = ratings.reduce((sum, r) => {
            return sum + ((r.quality_rating + r.communication_rating + r.timeliness_rating + r.professionalism_rating + r.value_rating) / 5.0);
          }, 0);
          averageRating = totalRating / reviewCount;
        }

        // Calculate distance if user ZIP provided
        let distance = null;
        if (zip && contractor.zip_code) {
          // Simplified distance (mock for now)
          distance = zip === contractor.zip_code ? 0 : Math.floor(Math.random() * 50 + 1);
        }

        return {
          ...contractor,
          contractor_name: contractor.company_name || contractor.business_name || contractor.full_name,
          grade: grade.grade,
          grade_score: grade.score,
          grade_color: grade.color,
          grade_breakdown: grade.breakdown,
          has_verified_license: licenses && licenses.length > 0,
          licensed_trade: licenses?.[0]?.trade_type,
          license_state: licenses?.[0]?.state,
          review_count: reviewCount,
          average_rating: Math.round(averageRating * 10) / 10,
          distance_miles: distance
        };
      })
    );

    // Apply grade filter if specified
    let filteredContractors = enrichedContractors;
    if (minGrade) {
      const gradeValues = { 'F': 0, 'D': 40, 'C-': 50, 'C': 55, 'C+': 60, 'B-': 65, 'B': 70, 'B+': 75, 'A-': 80, 'A': 85, 'A+': 90 };
      const minScore = gradeValues[minGrade] || 0;
      filteredContractors = enrichedContractors.filter(c => c.grade_score >= minScore);
    }

    // Apply distance filter if specified
    if (maxDistance && zip) {
      filteredContractors = filteredContractors.filter(c => c.distance_miles !== null && c.distance_miles <= parseInt(maxDistance));
    }

    // Sort by grade score (highest first)
    filteredContractors.sort((a, b) => b.grade_score - a.grade_score);

    res.json({
      contractors: filteredContractors,
      total: filteredContractors.length,
      filters: {
        trade,
        minGrade,
        maxDistance,
        searchTerm,
        zip
      }
    });

  } catch (err) {
    console.error("❌ Error in /api/contractors/directory:", err);
    res.status(500).json({
      error: "Failed to load contractor directory",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractors/:email/grade
 * Get detailed grade breakdown for a specific contractor
 */
app.get("/api/contractors/:email/grade", async (req, res) => {
  try {
    const { email } = req.params;

    const { data: grade, error } = await supabase.rpc('calculate_contractor_grade', {
      p_contractor_email: email
    });

    if (error) throw error;

    res.json(grade || { grade: 'N/A', score: 0 });

  } catch (err) {
    console.error("❌ Error in /api/contractors/:email/grade:", err);
    res.status(500).json({
      error: "Failed to calculate contractor grade",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/contractors/:email/reviews
 * Get reviews for a specific contractor
 */
app.get("/api/contractors/:email/reviews", async (req, res) => {
  try {
    const { email } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const { data: reviews, error } = await supabase
      .from('contractor_ratings')
      .select(`
        *,
        homeowner:user_profiles!contractor_ratings_homeowner_email_fkey(full_name, city, state)
      `)
      .eq('contractor_email', email)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      reviews: reviews || [],
      total: reviews?.length || 0
    });

  } catch (err) {
    console.error("❌ Error in /api/contractors/:email/reviews:", err);
    res.status(500).json({
      error: "Failed to load contractor reviews",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// ========================================
// NOTIFICATIONS SYSTEM (SMS & EMAIL)
// ========================================

/**
 * POST /api/notifications/process-queue
 * Process pending notifications and send via SMS/Email
 * NOTE: Run this via cron job every 1-5 minutes
 */
app.post("/api/notifications/process-queue", async (req, res) => {
  try {
    // Get all queued notifications
    const { data: notifications, error } = await supabase
      .from('notification_log')
      .select('*')
      .or('sms_status.eq.queued,email_status.eq.queued')
      .limit(100);

    if (error) throw error;

    let smsCount = 0;
    let emailCount = 0;
    const errors = [];

    for (const notification of notifications || []) {
      // Send SMS if queued
      if (notification.sms_status === 'queued' && notification.recipient_phone) {
        try {
          // TODO: Implement Twilio SMS sending
          // const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
          // const message = await twilioClient.messages.create({
          //   body: notification.message,
          //   from: TWILIO_PHONE_NUMBER,
          //   to: notification.recipient_phone
          // });

          // For now, just mark as sent (placeholder)
          await supabase
            .from('notification_log')
            .update({
              sms_status: 'sent',
              sms_sent_at: new Date().toISOString(),
              // sms_sid: message.sid
            })
            .eq('id', notification.id);

          smsCount++;
          console.log(`📱 SMS sent to ${notification.recipient_phone}`);

        } catch (smsError) {
          console.error('SMS error:', smsError);
          errors.push({ type: 'sms', id: notification.id, error: smsError.message });

          await supabase
            .from('notification_log')
            .update({
              sms_status: 'failed',
              sms_error: smsError.message
            })
            .eq('id', notification.id);
        }
      }

      // Send Email if queued
      if (notification.email_status === 'queued' && notification.recipient_email) {
        try {
          // TODO: Implement email sending (nodemailer or SendGrid)
          // const transporter = nodemailer.createTransport({...});
          // const info = await transporter.sendMail({
          //   from: '"HomeProHub" <notifications@homeprohub.today>',
          //   to: notification.recipient_email,
          //   subject: notification.subject,
          //   html: notification.message
          // });

          // For now, just mark as sent (placeholder)
          await supabase
            .from('notification_log')
            .update({
              email_status: 'sent',
              email_sent_at: new Date().toISOString(),
              // email_message_id: info.messageId
            })
            .eq('id', notification.id);

          emailCount++;
          console.log(`📧 Email sent to ${notification.recipient_email}`);

        } catch (emailError) {
          console.error('Email error:', emailError);
          errors.push({ type: 'email', id: notification.id, error: emailError.message });

          await supabase
            .from('notification_log')
            .update({
              email_status: 'failed',
              email_error: emailError.message
            })
            .eq('id', notification.id);
        }
      }
    }

    res.json({
      success: true,
      sms_sent: smsCount,
      email_sent: emailCount,
      total_processed: notifications?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("❌ Error processing notification queue:", err);
    res.status(500).json({
      error: "Failed to process notifications",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/contractors/notification-preferences
 * Update notification preferences for contractor
 */
app.put("/api/contractors/notification-preferences", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const {
      notifications_sms_enabled,
      notifications_email_enabled,
      service_radius_miles
    } = req.body;

    const updates = {};

    if (typeof notifications_sms_enabled === 'boolean') {
      updates.notifications_sms_enabled = notifications_sms_enabled;
    }

    if (typeof notifications_email_enabled === 'boolean') {
      updates.notifications_email_enabled = notifications_email_enabled;
    }

    if (service_radius_miles && service_radius_miles >= 5 && service_radius_miles <= 100) {
      updates.service_radius_miles = parseInt(service_radius_miles);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided',
        code: 'VALIDATION_ERROR'
      });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('email', userEmail)
      .eq('role', 'contractor')
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      preferences: {
        notifications_sms_enabled: data.notifications_sms_enabled,
        notifications_email_enabled: data.notifications_email_enabled,
        service_radius_miles: data.service_radius_miles
      }
    });

  } catch (err) {
    console.error("❌ Error updating notification preferences:", err);
    res.status(500).json({
      error: "Failed to update preferences",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/contractors/verify-phone
 * Send SMS verification code to contractor's phone
 */
app.post("/api/contractors/verify-phone", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { phone } = req.body;

    if (!phone || !/^\+?1?\d{10,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        code: 'VALIDATION_ERROR'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user profile with verification code
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        phone: phone,
        phone_verification_code: verificationCode,
        phone_verification_expires: expiresAt.toISOString(),
        phone_verified: false
      })
      .eq('email', userEmail);

    if (updateError) throw updateError;

    // TODO: Send SMS with Twilio
    // const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    // await twilioClient.messages.create({
    //   body: `Your HomeProHub verification code is: ${verificationCode}`,
    //   from: TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    console.log(`📱 Verification code sent to ${phone}: ${verificationCode}`);

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
      // In development, return code for testing
      ...(process.env.NODE_ENV === 'development' ? { code: verificationCode } : {})
    });

  } catch (err) {
    console.error("❌ Error sending verification code:", err);
    res.status(500).json({
      error: "Failed to send verification code",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/contractors/confirm-phone
 * Confirm phone verification code
 */
app.post("/api/contractors/confirm-phone", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Verification code required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get user profile
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('phone_verification_code, phone_verification_expires, phone_verified')
      .eq('email', userEmail)
      .single();

    if (fetchError) throw fetchError;

    // Check if already verified
    if (profile.phone_verified) {
      return res.json({
        success: true,
        message: 'Phone already verified'
      });
    }

    // Check if code matches
    if (profile.phone_verification_code !== code) {
      return res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_CODE'
      });
    }

    // Check if code expired
    if (new Date(profile.phone_verification_expires) < new Date()) {
      return res.status(400).json({
        error: 'Verification code expired. Please request a new one.',
        code: 'CODE_EXPIRED'
      });
    }

    // Mark phone as verified
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        phone_verified: true,
        phone_verification_code: null,
        phone_verification_expires: null
      })
      .eq('email', userEmail);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Phone verified successfully'
    });

  } catch (err) {
    console.error("❌ Error confirming phone verification:", err);
    res.status(500).json({
      error: "Failed to verify phone",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * PUT /api/homeowners/notification-preferences
 * Update notification preferences for homeowner
 */
app.put("/api/homeowners/notification-preferences", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const {
      notifications_sms_enabled,
      notifications_email_enabled
    } = req.body;

    const updates = {};

    if (typeof notifications_sms_enabled === 'boolean') {
      updates.notifications_sms_enabled = notifications_sms_enabled;
    }

    if (typeof notifications_email_enabled === 'boolean') {
      updates.notifications_email_enabled = notifications_email_enabled;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided',
        code: 'VALIDATION_ERROR'
      });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('email', userEmail)
      .eq('role', 'homeowner')
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      preferences: {
        notifications_sms_enabled: data.notifications_sms_enabled,
        notifications_email_enabled: data.notifications_email_enabled
      }
    });

  } catch (err) {
    console.error("❌ Error updating notification preferences:", err);
    res.status(500).json({
      error: "Failed to update preferences",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/homeowners/verify-phone
 * Send SMS verification code to homeowner's phone
 */
app.post("/api/homeowners/verify-phone", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Get phone from user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('phone')
      .eq('email', userEmail)
      .eq('role', 'homeowner')
      .single();

    if (profileError) throw profileError;

    const phone = profile.phone;

    if (!phone || !/^\+?1?\d{10,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({
        error: 'Invalid phone number format. Please update your phone number in your profile.',
        code: 'VALIDATION_ERROR'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user profile with verification code
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        phone_verification_code: verificationCode,
        phone_verification_expires: expiresAt.toISOString(),
        phone_verified: false
      })
      .eq('email', userEmail);

    if (updateError) throw updateError;

    // TODO: Send SMS with Twilio
    // const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    // await twilioClient.messages.create({
    //   body: `Your HomeProHub verification code is: ${verificationCode}`,
    //   from: TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    console.log(`📱 Verification code sent to ${phone}: ${verificationCode}`);

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
      // In development, return code for testing
      code: verificationCode // Always return for now since SMS not fully configured
    });

  } catch (err) {
    console.error("❌ Error sending verification code:", err);
    res.status(500).json({
      error: "Failed to send verification code",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * POST /api/homeowners/confirm-phone
 * Confirm phone verification code
 */
app.post("/api/homeowners/confirm-phone", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Verification code required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get user profile
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('phone_verification_code, phone_verification_expires, phone_verified')
      .eq('email', userEmail)
      .eq('role', 'homeowner')
      .single();

    if (fetchError) throw fetchError;

    // Check if already verified
    if (profile.phone_verified) {
      return res.json({
        success: true,
        message: 'Phone already verified'
      });
    }

    // Check if code matches
    if (profile.phone_verification_code !== code) {
      return res.status(400).json({
        error: 'Invalid verification code',
        code: 'INVALID_CODE'
      });
    }

    // Check if code expired
    if (new Date(profile.phone_verification_expires) < new Date()) {
      return res.status(400).json({
        error: 'Verification code expired. Please request a new one.',
        code: 'CODE_EXPIRED'
      });
    }

    // Mark phone as verified
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        phone_verified: true,
        phone_verification_code: null,
        phone_verification_expires: null
      })
      .eq('email', userEmail);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Phone verified successfully'
    });

  } catch (err) {
    console.error("❌ Error confirming phone verification:", err);
    res.status(500).json({
      error: "Failed to verify phone",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

/**
 * GET /api/homeowner/stats
 * Get homeowner's activity statistics
 */
app.get("/api/homeowner/stats", requireAuth, async (req, res) => {
  try {
    const userEmail = req.query.email || req.user.email;

    // Get total jobs
    const { count: totalJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('homeowner_email', userEmail);

    if (jobsError) throw jobsError;

    // Get active jobs
    const { count: activeJobs, error: activeError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('homeowner_email', userEmail)
      .in('status', ['open', 'in_progress']);

    if (activeError) throw activeError;

    // Get completed jobs
    const { count: completedJobs, error: completedError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('homeowner_email', userEmail)
      .eq('status', 'completed');

    if (completedError) throw completedError;

    // Get total bids received
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('homeowner_email', userEmail);

    const jobIds = jobs?.map(j => j.id) || [];

    let totalBids = 0;
    if (jobIds.length > 0) {
      const { count: bidsCount, error: bidsError } = await supabase
        .from('contractor_bids')
        .select('*', { count: 'exact', head: true })
        .in('job_id', jobIds);

      if (bidsError) throw bidsError;
      totalBids = bidsCount || 0;
    }

    res.json({
      total_jobs: totalJobs || 0,
      active_jobs: activeJobs || 0,
      completed_jobs: completedJobs || 0,
      total_bids: totalBids
    });

  } catch (err) {
    console.error("❌ Error fetching homeowner stats:", err);
    res.status(500).json({
      error: "Failed to fetch statistics",
      code: 'INTERNAL_ERROR',
      message: err.message
    });
  }
});

// ====== 404 HANDLER ======
// This must be the LAST route handler, after all other routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// ====== GLOBAL ERROR HANDLER ======
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ====== START SERVER ======
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`🚀 HomeProHub Server`);
  console.log(`📍 Running at: http://localhost:${PORT}`);
  console.log(`🔑 Anthropic API: ${ANTHROPIC_API_KEY ? '✓ Configured' : '❌ Missing'}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('========================================');
});
