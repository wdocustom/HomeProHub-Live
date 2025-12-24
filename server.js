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
 * Homeowner AI assistant - analyzes home issues with optional image
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

    // Text prompt
    contentBlocks.push({
      type: "text",
      text: `You are an experienced home contractor and home inspector.
Explain things simply and focus on safety.

The homeowner described this issue with their home:
${sanitizedQuestion}

If an image is provided, use it as additional context.

Respond using EXACTLY this structure:
1. Summary, Severity & Urgency: [1-2 sentence summary, Severity: High/Medium/Low, Urgency: Fix now/soon/monitor]
2. Likely Causes: [2-5 bullet points]
3. Step-by-Step Checks (DIY-friendly): [Numbered steps]
4. Materials & Tools You May Need: [Short bullet list]
5. Safety Warnings: [Clear bullet points]
6. When to Call a Pro: [Explain when and what type of contractor]
7. What to Tell a Contractor: [Short script]`
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
        max_tokens: 800,
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

    console.log(`✓ Homeowner question answered (${answer.length} chars)`);

    res.json({ answer });

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

    // Special instructions for pricing estimates
    const pricingExtra = selectedFocus === "pricing"
      ? `

SPECIAL INSTRUCTIONS FOR DOWNLOADABLE ESTIMATE (OVERRIDE):
- Input Data: Scope Level: ${scopeLevel || 'Not specified'}, Size: ${size || 'Not specified'}.
- INJECTED RAG DATA: You MUST reference the provided regional Labor Rates and Multiplier (${ragData.regionalMultiplier}).
- Use the Trades required (Plumber, Electrician, etc.) and multiply their base rate by the Regional Multiplier to calculate labor costs.
- Your response MUST be a single, raw JSON object. Do not wrap it in any text, markdown, or commentary.
- The ZIP code must be provided. If not, the JSON output MUST contain only: {"error": "ZIP code missing."}.
- If ZIP is provided, generate a detailed estimate object (always in USD) containing the following fields:
  * "status": "ok"
  * "project_title": [Brief title based on description]
  * "line_items": [Array of objects: {"item": "Trade/Material Name", "low": 0, "high": 0, "notes": "Scope details"}]
  * "subtotal_low": [Sum of all 'low' line items]
  * "subtotal_high": [Sum of all 'high' line items]
  * "overhead_profit_percent": [15-25, based on scope]
  * "contingency_percent": [5-10, based on scope complexity]
  * "total_projected_low": [Calculated total including O&P/Contingency]
  * "total_projected_high": [Calculated total including O&P/Contingency]
  * "disclaimers": ["Estimate is non-binding and regional.", "Final quote requires site visit."]
`
      : "";

    // Build prompt
    const contentText = `You are an experienced, licensed contractor and business mentor.

--- BEGIN RAG CONTEXT ---
Labor Rates (Base $/hr): ${JSON.stringify(ragData.laborRates)}
Permit Cost Samples: ${JSON.stringify(ragData.samplePermitFees)}
Regional Multiplier: ${ragData.regionalMultiplier}
--- END RAG CONTEXT ---

FOCUS AREA: ${focusDescription}
JOB ZIP (if provided): ${zip || "Not provided"}${pricingExtra}

Contractor's situation:
${sanitizedQuestion}

Give practical, grounded advice based on real-world experience.
Avoid guessing about local code specifics—remind them to check their local code and licensing board if needed.

Respond using EXACTLY this structure:
1. Quick Summary (2–4 sentences)
2. Key Considerations (3–7 bullet points)
3. Suggested Approach / Strategy (Numbered steps)
4. Pricing & Scope Guidance (if relevant):
   - **Pricing:** If a ZIP is provided, use the override instructions above to generate a detailed, structured estimate table including O&P and Contingency.
   - **Scope:** How to structure allowances, exclusions, and define clear contract limits to minimize change orders.
5. Licensing, Code & Risk
6. Communication Script
7. Next Moves (3–5 concrete actions)
`;

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
        max_tokens: 900,
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
