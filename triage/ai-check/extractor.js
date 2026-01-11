/**
 * Vision Extractor - Multimodal Image Analysis
 * Extracts structured observations from 1-5 photos
 */

const { ObservationSchema } = require('./schema');

/**
 * Vision Extractor System Prompt
 */
function getExtractorSystemPrompt() {
  return `You are a vision analysis system for home repair diagnosis.

TASK: Analyze the provided photo(s) and extract structured observations.

INSTRUCTIONS:
1. Identify ALL visible damage, defects, or issues
2. Note materials you can see (wood, drywall, tile, shingles, etc.)
3. Determine location context (bathroom, kitchen, exterior, roof, etc.)
4. Flag any URGENT safety indicators (active water, exposed wiring, structural damage, mold)
5. Assess apparent age/condition (new, recent, aging, deteriorated)
6. If user provided text description, summarize it briefly

OUTPUT FORMAT:
You must return a valid JSON object matching this structure:
{
  "visible_damage": ["issue1", "issue2", ...],
  "materials_identified": ["material1", "material2", ...],
  "location_context": "where this is",
  "urgency_indicators": ["safety concern 1", ...],
  "age_condition": "new|recent|aging|deteriorated|unknown",
  "text_description_summary": "brief summary if text provided"
}

BE SPECIFIC: Instead of "damage", say "water staining on ceiling drywall" or "cracked roof shingles".

SAFETY FIRST: Always flag electrical, water, structural, or mold concerns in urgency_indicators.

RETURN ONLY JSON. NO EXPLANATIONS OUTSIDE THE JSON OBJECT.`;
}

/**
 * Vision Extractor User Prompt
 */
function getExtractorUserPrompt(textDescription, imageCount) {
  let prompt = '';

  if (textDescription && textDescription.trim()) {
    prompt += `USER DESCRIPTION:\n${textDescription}\n\n`;
  }

  if (imageCount > 0) {
    prompt += `IMAGES PROVIDED: ${imageCount} photo(s)\n\n`;
    prompt += `Analyze the photo(s) and extract observations.\n`;
  } else {
    prompt += `No photos provided. Extract observations from the text description only.\n`;
  }

  prompt += `\nReturn the observation data as JSON matching the schema.`;

  return prompt;
}

/**
 * Run Vision Extractor with retry logic
 * @param {Object} provider - AI provider (Anthropic or OpenAI)
 * @param {string} textDescription - User's text description
 * @param {Array<{type: string, source: Object}>} images - Array of image content blocks
 * @returns {Promise<{observation: Object, retries: number, rawResponse: string}>}
 */
async function runExtractor(provider, textDescription, images = []) {
  const systemPrompt = getExtractorSystemPrompt();
  const userPrompt = getExtractorUserPrompt(textDescription, images.length);

  // Build messages with images
  const userContent = [];

  // Add text first
  userContent.push({
    type: 'text',
    text: userPrompt,
  });

  // Add images (up to 5)
  images.slice(0, 5).forEach((image) => {
    userContent.push(image);
  });

  let retries = 0;
  let rawResponse = '';

  try {
    // PASS 1: Initial extraction attempt
    rawResponse = await provider.generate(systemPrompt, userContent);
    const observation = parseAndValidateObservation(rawResponse);
    return { observation, retries, rawResponse };
  } catch (error) {
    console.error('Vision Extractor PASS 1 failed:', error.message);
    retries = 1;

    try {
      // PASS 2: Repair attempt
      const repairPrompt = `The previous response was invalid. Error: ${error.message}

Original response:
${rawResponse}

Please return a corrected JSON object matching the ObservationSchema.`;

      const repairedResponse = await provider.generate(systemPrompt, [
        { type: 'text', text: repairPrompt },
      ]);
      const observation = parseAndValidateObservation(repairedResponse);
      return { observation, retries, rawResponse: repairedResponse };
    } catch (repairError) {
      console.error('Vision Extractor PASS 2 repair failed:', repairError.message);
      retries = 2;

      // PASS 3: Fallback to safe default
      const fallback = getSafeDefaultObservation(textDescription);
      return { observation: fallback, retries, rawResponse };
    }
  }
}

/**
 * Parse and validate observation JSON
 */
function parseAndValidateObservation(text) {
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
  const result = ObservationSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Safe default observation (fallback)
 */
function getSafeDefaultObservation(textDescription) {
  return {
    visible_damage: ['Issue requiring professional assessment'],
    materials_identified: ['Unknown'],
    location_context: 'Home interior or exterior',
    urgency_indicators: [],
    age_condition: 'unknown',
    text_description_summary: textDescription
      ? textDescription.substring(0, 200)
      : 'No description provided',
  };
}

module.exports = {
  runExtractor,
  getExtractorSystemPrompt,
  getExtractorUserPrompt,
};
