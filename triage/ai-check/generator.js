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
  "summary": "2-3 sentences explaining what this is, what caused it, and what it means for the homeowner",
  "likely_causes": [
    {"label": "Toilet wax ring failure", "why": "Water staining pattern indicates leak from above", "likelihood": "most_likely"},
    {"label": "Shower pan breach", "why": "Could explain water damage if bathroom is above", "likelihood": "possible"}
  ],
  "do_now": ["Turn off water to bathroom above if accessible", "Place bucket under active drip"],
  "dont_do": ["Don't ignore active drip - mold grows in 24-48 hours", "Don't patch ceiling until leak source is fixed"],
  "diy_level": "pro_recommended",
  "who_to_call": {
    "trade": "plumber",
    "why": "Plumber can identify exact leak source and prevent further water damage"
  },
  "cost_tier": {
    "tier": "medium",
    "drivers": ["Leak source location", "Extent of hidden water damage", "Ceiling drywall replacement", "Subfloor damage if present"]
  },
  "one_question": "Is the bathroom directly above this spot currently in use?",
  "cta": {
    "primary": {"label": "Find Local Plumbers", "action": "browse_contractors"},
    "secondary": {"label": "Save This Report", "action": "save_report"}
  },
  "pro_message": "When you contact a plumber, let them know you have an active ceiling leak with water staining. Ask them to inspect the bathroom above for toilet seal failure or shower pan issues. Request moisture detection to check for hidden damage in walls and subfloor. Get quotes for both leak repair and any necessary drywall/ceiling work.",
  "confidence": "high",
  "safety_flags": ["Active water damage", "Potential mold growth"]
}

RULES:
1. summary: 2-3 sentences, calm and informative, explain diagnosis clearly
2. likely_causes: 2-3 items with label, why, and likelihood (most_likely/possible/less_likely)
3. do_now: 1-3 immediate SAFE actions that homeowner can take right now
4. dont_do: 2-4 common mistakes homeowners make with this issue
5. diy_level:
   - safe_to_diy: Simple fix, homeowner can handle safely
   - inspection_only: Need pro to assess, but not urgent
   - pro_recommended: Hire a licensed pro, schedule normally
   - urgent: Get help ASAP (active safety risk)
6. who_to_call: Specify trade + why this trade is needed
7. cost_tier: tier (low/medium/high/unknown) + 2-4 cost drivers
   - low: Under $500 (minor repairs, handyman work)
   - medium: $500-5k (single-trade repairs, moderate projects)
   - high: Over $5k (major work, full remodels, structural)
   - unknown: Cannot estimate without inspection
8. one_question: Only ask if answer MATERIALLY changes diagnosis. Otherwise null.
9. cta: Primary action (required) + optional secondary action
10. pro_message: 3-6 sentences, copy/paste ready for homeowner to send to contractors
11. confidence: Your overall confidence in this diagnosis (low/medium/high)
12. safety_flags: Plain text warnings (e.g. "Active water damage", "Electrical hazard")

BE DECISIVE. Don't hedge with "might be" or "could be". Say "This is most likely X because Y."
BE PRACTICAL. Focus on what the homeowner should DO, not just what's wrong.
BE CALM. No fear-mongering. Reassure when appropriate, warn clearly when necessary.

RETURN ONLY JSON. NO MARKDOWN. NO EXPLANATIONS OUTSIDE THE JSON OBJECT.`;
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
    summary: 'This issue requires professional assessment to provide an accurate diagnosis. Based on the limited information available, a licensed contractor can inspect the problem in person and recommend the appropriate solution. Getting a professional opinion is the safest next step.',
    likely_causes: [
      {
        label: 'Requires in-person inspection',
        why: 'Cannot determine exact cause from available information',
        likelihood: 'most_likely',
      },
      {
        label: 'Multiple potential factors',
        why: 'Issue may involve several contributing causes',
        likelihood: 'possible',
      },
    ],
    do_now: ['Document the issue with additional photos', 'Note when the problem started and any changes over time'],
    dont_do: ['Attempt repairs without professional assessment', 'Ignore the issue if it worsens'],
    diy_level: 'inspection_only',
    who_to_call: {
      trade: primaryTrade,
      why: 'Licensed professional can provide accurate diagnosis and repair recommendations',
    },
    cost_tier: {
      tier: 'unknown',
      drivers: ['Depends on diagnosis after inspection', 'Accessibility and complexity', 'Materials and labor required'],
    },
    one_question: null,
    cta: {
      primary: {
        label: 'Find Local Contractors',
        action: 'browse_contractors',
      },
      secondary: {
        label: 'Save This Report',
        action: 'save_report',
      },
    },
    pro_message:
      'I have a home repair issue that needs professional inspection. The problem involves ' +
      (textDescription || 'the area shown in the photos') +
      '. I would like to schedule an inspection to get an accurate diagnosis and quote for repairs. Please let me know your availability and what information you need from me.',
    confidence: 'low',
    safety_flags: observation.urgency_indicators.length > 0 ? observation.urgency_indicators : [],
  };
}

module.exports = {
  runGenerator,
  getGeneratorSystemPrompt,
  getGeneratorUserPrompt,
};
