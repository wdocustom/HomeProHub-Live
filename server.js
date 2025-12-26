// Load environment variables from .env file
require('dotenv').config();

// ====== IMPORTS ======
const express = require("express");
const cors = require("cors");
const path = require('path');
const fs = require('fs');

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
const db = require('./database/db');

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
 * POST /api/submit-job
 * Submit a new job posting from homeowner
 */
app.post("/api/submit-job", async (req, res) => {
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
app.get("/api/jobs", async (req, res) => {
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
app.post("/api/jobs", async (req, res) => {
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
app.get("/api/jobs/:jobId", async (req, res) => {
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
app.get("/api/homeowner/jobs", async (req, res) => {
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
 * POST /api/submit-bid
 * Submit a contractor bid on a job
 */
app.post("/api/submit-bid", async (req, res) => {
  try {
    const {
      jobId,
      contractorEmail,
      bidAmountLow,
      bidAmountHigh,
      estimatedDuration,
      startAvailability,
      message
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

    // Create bid
    const bidData = {
      job_id: jobId,
      contractor_email: contractorEmail,
      contractor_id: contractorProfile.id,
      contractor_business_name: contractorProfile.business_name || contractorProfile.company_name,
      bid_amount_low: bidAmountLow,
      bid_amount_high: bidAmountHigh,
      estimated_duration: estimatedDuration,
      start_availability: startAvailability,
      message: message,
      status: 'pending'
    };

    const bid = await db.submitBid(bidData);

    // Get job details for notification
    const job = await db.getJobById(jobId);

    // Create notification for homeowner
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

    // Log activity
    await db.logActivity({
      user_email: contractorEmail,
      user_id: contractorProfile.id,
      activity_type: 'bid_submitted',
      description: `Submitted bid on job: ${job.title}`,
      metadata: { job_id: jobId, bid_id: bid.id }
    });

    console.log(`✓ Bid submitted: ${bid.id} by ${contractorEmail} on job ${jobId}`);
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
app.get("/api/contractor/bids", async (req, res) => {
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
app.post("/api/bid/accept", async (req, res) => {
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

// ========================================
// LICENSE MANAGEMENT API ENDPOINTS
// ========================================

/**
 * POST /api/contractor/licenses
 * Add or update contractor license
 */
app.post("/api/contractor/licenses", async (req, res) => {
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
app.get("/api/contractor/licenses", async (req, res) => {
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
app.get("/api/contractor/licenses/check", async (req, res) => {
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
 * PUT /api/contractor/licenses/:id/verify
 * Update license verification status (admin only)
 */
app.put("/api/contractor/licenses/:id/verify", async (req, res) => {
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
app.post("/api/messages/send", async (req, res) => {
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
        message: sanitizedMessage
      });

      console.log(`✓ Message sent in conversation: ${conversation_id}`);
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
app.get("/api/messages/thread/:threadId", async (req, res) => {
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
app.get("/api/messages/conversations", async (req, res) => {
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
app.post("/api/conversations/create", async (req, res) => {
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
app.get("/api/conversations", async (req, res) => {
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
 * GET /api/messages/:conversationId
 * Get all messages for a specific conversation
 */
app.get("/api/messages/:conversationId", async (req, res) => {
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
app.post("/api/messages/send-conversation", async (req, res) => {
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
app.post("/api/conversations/:conversationId/read", async (req, res) => {
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
app.get("/api/notifications", async (req, res) => {
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
 * GET /api/messages/unread
 * Get unread message count only (for navigation)
 */
app.get("/api/messages/unread", async (req, res) => {
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

// ====== 404 HANDLER ======
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
