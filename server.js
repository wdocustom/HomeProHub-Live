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

// 🔐 Securely load Anthropic API key from process.env (FIXED SYNTAX)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn("⚠️ ANTHROPIC_API_KEY is not set in environment variables.");
}

const app = express();

// Allow JSON bodies (increase limit for images)
app.use(express.json({ limit: "10mb" }));

// Allow browser requests (Final CORS Configuration)
const allowedOrigins = [
  'http://localhost:3000',
  'https://www.homeprohub.today',
  'https://homeprohub.today',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Serve files from /public (home.html, ask.html, etc.)
app.use(express.static("public"));

// --- FINAL AUTH API ROUTES (Client-Side Auth) ---

// Route for Saving User Role (Used by role-selection.html)
app.post('/api/set-role', (req, res) => {
    // In a live application, the server would save the role to the database here.
    // For now, we confirm success as the client manages the role locally (Supabase pattern).
    const { username } = req.body;
    if (username) {
        return res.json({ success: true, message: 'Role received and processed.' });
    }
    return res.status(400).json({ error: 'Username not provided for role assignment.' });
});

// ====== ROUTE: /ask (HOMEOWNER AI) ======
app.post("/ask", async (req, res) => {
  const { question, imageBase64, imageType } = req.body;

  if (!question) {
    return res.status(400).json({ error: "No question provided." });
  }

  // Content blocks to send to Claude
  const contentBlocks = [];

  // 1) Text instruction + user question (Simplified Prompt for Stability)
  contentBlocks.push({
    type: "text",
    text: `You are an experienced home contractor and home inspector.
Explain things simply and focus on safety.

The homeowner described this issue with their home:${question}

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

  // 2) Optional image block
  if (imageBase64 && imageType) {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageType, // e.g. "image/jpeg"
        data: imageBase64
      }
    });
  }

  try {
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
      const text = await apiResponse.text();
      console.error("Anthropic error:", text);
      return res
        .status(500)
        .json({ error: "Anthropic API error: " + apiResponse.status });
    }

    const data = await apiResponse.json();

    const answer =
      data.content && data.content[0]?.text
      ? data.content[0].text
      : "Claude didn't return any text.";

    res.json({ answer });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error talking to Claude." });
  }
});

// ====== ROUTE: /contractor-ask (CONTRACTOR COACH) ======
app.post("/contractor-ask", async (req, res) => {
  const { question, focus, zip, scopeLevel, size } = req.body;

  if (!question) {
    return res.status(400).json({ error: "No question provided." });
  }

  // --- RAG IMPLEMENTATION: LOAD COST DATA ---
  let ragData = { laborRates: 'unavailable', permits: 'unavailable' };
  try {
    const laborPath = path.resolve(__dirname, 'public', 'labor-rates.json');
    const permitPath = path.resolve(__dirname, 'public', 'permit-fees.json');
    
    const laborData = JSON.parse(fs.readFileSync(laborPath, 'utf8'));
    const permitData = JSON.parse(fs.readFileSync(permitPath, 'utf8'));

    // Determine regional multiplier based on ZIP prefix
    const zipPrefix = zip ? zip.substring(0, 3) : 'other';
    const multiplier = laborData.regional_multipliers[zipPrefix] || laborData.regional_multipliers['other'];
    
    // Inject key RAG data points
    ragData = {
        laborRates: laborData.rates_by_trade,
        regionalMultiplier: multiplier,
        samplePermitFees: permitData.projects
    };

  } catch (e) {
      console.warn("RAG DATA LOAD FAILED:", e.message);
  }
  // --- END RAG IMPLEMENTATION ---

  const focusDescription = {
    general: "General contractor / project advice",
    pricing: "Pricing and estimating jobs profitably and fairly",
    materials: "Materials, methods, and build quality trade-offs",
    licensing: "Licensing, insurance, permitting and compliance",
    client_comms: "Client communication, expectations and change orders",
    business: "Business systems, profitability and long-term strategy"
  }[focus] || "General contractor guidance";

  const pricingExtra =
    focus === "pricing"
      ? `

SPECIAL INSTRUCTIONS FOR DOWNLOADABLE ESTIMATE (OVERRIDE):
- Input Data: Scope Level: ${scopeLevel}, Size: ${size}.
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

  const contentText = `You are an experienced, licensed contractor and business mentor.
You are talking to another contractor (or aspiring contractor).
They may be in residential trades (GC, plumbing, electrical, HVAC, remodeling, etc.).

--- BEGIN RAG CONTEXT ---
Labor Rates (Base $/hr): ${JSON.stringify(ragData.laborRates)}
Permit Cost Samples: ${JSON.stringify(ragData.samplePermitFees)}
Regional Multiplier: ${ragData.regionalMultiplier}
--- END RAG CONTEXT ---

FOCUS AREA: ${focusDescription}
JOB ZIP (if provided): ${zip || "Not provided"}${pricingExtra}

Contractor's situation:${question}

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

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-03-01" // Note: Reverting API version to 2023-03-01 for stability
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
      const text = await apiResponse.text();
      console.error("Anthropic contractor error:", text);
      return res
        .status(500)
        .json({ error: "Anthropic API error (contractor): " + apiResponse.status });
    }

    const data = await apiResponse.json();
    const rawAnswer = data.content[0].text.trim();

    // Attempt to parse JSON only if pricing is requested
    if (focus === "pricing") {
        try {
            const cleanedJson = rawAnswer.replace(/```json\s*|```/g, '').trim();
            const jsonAnswer = JSON.parse(cleanedJson);
            return res.json({ answer: jsonAnswer, format: 'json' });
        } catch (jsonErr) {
            console.error("JSON PARSE FAILURE:", jsonErr);
            return res.json({ answer: rawAnswer, format: 'text', error: "AI response was not valid JSON." });
        }
    } else {
        // For non-pricing questions, return plain text
        return res.json({ answer: rawAnswer, format: 'text' });
    }
  } catch (err) {
    console.error("Server error (contractor):", err);
    res.status(500).json({ error: "Server error talking to Claude (contractor)." });
  }
});

// ====== ROUTE: /plan-project (HOMEOWNER PROJECT PLANNER) ======
app.post("/plan-project", async (req, res) => {
  const { projectDescription, location } = req.body;

  if (!projectDescription) {
    return res.status(400).json({ error: "No project description provided." });
  }

  const locationHint = location ? `The project location is: ${location}. Use this to inform local cost estimates and permitting mentions.` : "No specific location was provided; use generic national averages for cost and time.";

  const contentText = `You are an experienced residential Project Manager and Home Remodel Consultant.
Your task is to take a homeowner's simple idea and create a realistic, phase-based project plan.
The goal is to prepare the homeowner for conversations with contractors and help them understand the scope, complexity, and budget.

Project Idea: ${projectDescription}
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

  try {
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-03-01" // Note: Reverting API version to 2023-03-01 for stability
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
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
      const text = await apiResponse.text();
      console.error("Anthropic planner error:", text);
      return res
        .status(500)
        .json({ error: "Anthropic API error (planner): " + apiResponse.status });
    }

    const data = await apiResponse.json();

    const answer =
      data.content && data.content[0]?.text
      ? data.content[0].text
      : "Claude didn't return any text.";

    res.json({ answer });
  } catch (err) {
    console.error("Server error (planner):", err);
    res.status(500).json({ error: "Server error talking to Claude (planner)." });
  }
});

// ====== ROUTE: /grading-data (SERVES GRADING JSON DATA) ======
app.get("/grading-data", (req, res) => {
  // This uses the path module which MUST be declared at the top of the file.
  const filePath = path.resolve(__dirname, 'public', 'grading-logic.json');

  // Check if file exists (using fs module, which MUST be declared at the top)
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Grading logic file not found at: ${filePath}`);
    return res.status(404).json({ error: "Grading logic file not found on server." });
  }

  // Read the file and serve the data
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading grading logic file:", err);
      return res.status(500).json({ error: "Could not read grading data." });
    }
    
    // Serve the data as JSON
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error("Error parsing grading logic file:", parseError);
      res.status(500).json({ error: "Invalid JSON format in grading file." });
    }
  });
});
// ====== START SERVER ======
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});