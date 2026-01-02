/**
 * Generator - Final Diagnosis Output
 * Takes observations and produces structured, actionable guidance
 */

const { OutputContractSchema } = require('./schema');

/**
 * Generator System Prompt
 */
function getGeneratorSystemPrompt() {
  return `You are HomeProHub AI Check, a calm, decisive home repair diagnosis system.

MISSION: Give homeowners clear, actionable guidance in <30 seconds of reading.

PERSONALITY:
- Calm and reassuring (not alarmist)
- Decisive (not "it could be...", say "this is most likely...")
- Practical (focus on next steps, not lectures)
- Safety-conscious (always flag real hazards)

OUTPUT CONTRACT:
You MUST return valid JSON matching this exact structure:

{
  "summary": "One calm sentence: 'This looks like X, typically caused by Y'",
  "likely_causes": [
    {"cause": "Most likely cause", "confidence": "high"},
    {"cause": "Second possibility", "confidence": "medium"}
  ],
  "do_now": ["Safe action 1", "Safe action 2"],
  "dont_do": ["Common mistake to avoid 1", "Mistake 2"],
  "diy_level": "safe_to_diy|inspection_only|pro_recommended|urgent",
  "who_to_call": {
    "primary_trade": "plumber|electrician|roofer|general_contractor|...",
    "secondary_trades": ["optional", "additional"]
  },
  "cost_tier": {
    "tier": "under_500|500_2k|2k_10k|10k_plus|unknown",
    "disclaimer": "Why this could vary"
  },
  "one_question": "ONE follow-up question that changes diagnosis (or null)",
  "cta": {
    "primary_action": "browse_contractors|post_project|schedule_inspection",
    "button_text": "Find Local Plumbers",
    "route": "browse-contractors?trade=plumber"
  },
  "pro_message": "Calm message for contractor browsing: 'Local plumbers can diagnose leak sources...'",
  "confidence": "low|medium|high",
  "safety_flags": ["electrical_hazard", "water_damage_active", ...]
}

RULES:
1. summary: ONE sentence, calm tone, specific diagnosis
2. likely_causes: Max 3, ranked by probability, with confidence levels
3. do_now: Max 3 immediate SAFE actions (turn off water, avoid area, etc.)
4. dont_do: Max 3 common mistakes (don't ignore, don't DIY electrical, etc.)
5. diy_level:
   - safe_to_diy: Simple fix, homeowner can handle
   - inspection_only: Need pro to assess, but not urgent
   - pro_recommended: Hire a pro, but schedule normally
   - urgent: Get help ASAP (safety risk)
6. who_to_call: Route to correct trade (plumber, electrician, etc.)
7. cost_tier: Ballpark range, explain what affects price
8. one_question: Only if it MATERIALLY changes diagnosis. Otherwise null.
9. cta: Route user to platform action (browse contractors, post project, etc.)
10. pro_message: What to tell homeowner when browsing contractors
11. safety_flags: ALWAYS include if electrical, water, structural, mold, gas, fire risks present

COST TIER GUIDANCE:
- under_500: Minor repairs, handyman work
- 500_2k: Single-trade repairs (toilet, outlet, small roof patch)
- 2k_10k: Moderate projects (water heater, small remodel)
- 10k_plus: Major work (roof replacement, foundation, full remodel)
- unknown: Truly can't estimate without inspection

DIY LEVEL GUIDANCE:
- safe_to_diy: Caulking, painting, minor repairs
- inspection_only: Uncertain cause, need pro eyes (not urgent)
- pro_recommended: Electrical, plumbing, structural, permits needed
- urgent: Active leak, exposed wiring, structural failure, mold

RETURN ONLY JSON. NO EXPLANATIONS OUTSIDE THE JSON OBJECT.`;
}

/**
 * Generator User Prompt
 */
function getGeneratorUserPrompt(observation, textDescription) {
  let prompt = 'OBSERVATION DATA:\n';
  prompt += JSON.stringify(observation, null, 2);
  prompt += '\n\n';

  if (textDescription && textDescription.trim()) {
    prompt += `ORIGINAL USER DESCRIPTION:\n${textDescription}\n\n`;
  }

  prompt += `Based on these observations, generate your diagnosis as JSON matching the Output Contract.

REMEMBER:
- Be calm and decisive
- One sentence summary
- Max 3 likely causes (ranked)
- Route to correct trade
- Include safety flags if warranted
- One follow-up question if it materially changes diagnosis (otherwise null)
- CTA to platform action

Return only the JSON object.`;

  return prompt;
}

/**
 * Run Generator with retry logic
 * @param {Object} provider - AI provider
 * @param {Object} observation - Observation from extractor
 * @param {string} textDescription - Original user description
 * @returns {Promise<{output: Object, retries: number, rawResponse: string}>}
 */
async function runGenerator(provider, observation, textDescription) {
  const systemPrompt = getGeneratorSystemPrompt();
  const userPrompt = getGeneratorUserPrompt(observation, textDescription);

  let retries = 0;
  let rawResponse = '';

  try {
    // PASS 1: Initial generation
    rawResponse = await provider.generate(systemPrompt, [{ type: 'text', text: userPrompt }]);
    const output = parseAndValidateOutput(rawResponse);
    return { output, retries, rawResponse };
  } catch (error) {
    console.error('Generator PASS 1 failed:', error.message);
    retries = 1;

    try {
      // PASS 2: Repair attempt
      const repairPrompt = `The previous response was invalid. Error: ${error.message}

Original response:
${rawResponse}

Please return a corrected JSON object matching the OutputContractSchema.`;

      const repairedResponse = await provider.generate(systemPrompt, [
        { type: 'text', text: repairPrompt },
      ]);
      const output = parseAndValidateOutput(repairedResponse);
      return { output, retries, rawResponse: repairedResponse };
    } catch (repairError) {
      console.error('Generator PASS 2 repair failed:', repairError.message);
      retries = 2;

      // PASS 3: Fallback to safe default
      const fallback = getSafeDefaultOutput(observation, textDescription);
      return { output: fallback, retries, rawResponse };
    }
  }
}

/**
 * Parse and validate output JSON
 */
function parseAndValidateOutput(text) {
  // Extract JSON from response
  let jsonStr = text.trim();

  // Try to extract JSON if wrapped in markdown code blocks
  const codeBlockMatch = jsonStr.match(/```json\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    // Try to find JSON object boundaries
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }

  // Validate with Zod
  const result = OutputContractSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Safe default output (fallback)
 */
function getSafeDefaultOutput(observation, textDescription) {
  // Determine primary trade based on observation
  let primaryTrade = 'general_contractor';
  const locationLower = observation.location_context.toLowerCase();

  if (
    locationLower.includes('roof') ||
    observation.materials_identified.some((m) => m.toLowerCase().includes('shingle'))
  ) {
    primaryTrade = 'roofer';
  } else if (
    locationLower.includes('plumb') ||
    locationLower.includes('bath') ||
    locationLower.includes('kitchen') ||
    observation.visible_damage.some((d) => d.toLowerCase().includes('leak'))
  ) {
    primaryTrade = 'plumber';
  } else if (
    locationLower.includes('electric') ||
    observation.visible_damage.some((d) => d.toLowerCase().includes('wiring'))
  ) {
    primaryTrade = 'electrician';
  }

  return {
    summary: 'This issue requires professional assessment to provide an accurate diagnosis.',
    likely_causes: [
      {
        cause: 'Issue requires in-person inspection',
        confidence: 'low',
      },
    ],
    do_now: ['Document the issue with photos', 'Note when the problem started'],
    dont_do: ['Attempt repairs without professional assessment'],
    diy_level: 'inspection_only',
    who_to_call: {
      primary_trade: primaryTrade,
      secondary_trades: [],
    },
    cost_tier: {
      tier: 'unknown',
      disclaimer: 'Cost depends on diagnosis after professional inspection',
    },
    one_question: null,
    cta: {
      primary_action: 'browse_contractors',
      button_text: 'Find Local Contractors',
      route: 'browse-contractors',
    },
    pro_message:
      'A licensed contractor can inspect this issue and provide an accurate quote for repairs.',
    confidence: 'low',
    safety_flags: observation.urgency_indicators.length > 0 ? ['none'] : ['none'],
  };
}

module.exports = {
  runGenerator,
  getGeneratorSystemPrompt,
  getGeneratorUserPrompt,
};
