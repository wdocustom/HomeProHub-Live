/**
 * Router Orchestration
 * Handles classification with retry and fallback logic
 */

const { RouterOutputSchema, getSafeDefaultRouterOutput } = require('./schema');
const { getRouterSystemPrompt, getRouterUserPrompt } = require('../prompts/router');
const { getRepairSystemPrompt, getRepairUserPrompt } = require('../prompts/repair');

/**
 * Run router pass with validation, retry, and fallback
 */
async function runRouter(provider, message, userContext) {
  let retries = 0;
  let lastError = null;
  let rawResponse = null;

  // First attempt
  try {
    const output = await attemptRouterPass(provider, message, userContext);
    console.log('✓ Router pass succeeded:', output);
    return { output, retries, rawResponse };
  } catch (error) {
    lastError = error;
    rawResponse = error.rawJson || null;
    console.log('⚠ Router validation failed, attempting repair...');
    retries = 1;

    // Retry with repair prompt
    try {
      const repairedOutput = await attemptRouterRepair(provider, rawResponse, error);
      console.log('✓ Router repair succeeded:', repairedOutput);
      return { output: repairedOutput, retries, rawResponse };
    } catch (repairError) {
      console.log('⚠ Router repair failed, using safe default');
      retries = 2;
    }
  }

  // Fallback to safe default
  const defaultOutput = getSafeDefaultRouterOutput();
  console.log('→ Using safe default router output');
  return { output: defaultOutput, retries, rawResponse };
}

/**
 * Attempt router classification
 */
async function attemptRouterPass(provider, message, userContext) {
  const systemPrompt = getRouterSystemPrompt();
  const userPrompt = getRouterUserPrompt(message, userContext);

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }
  );

  // Parse and validate JSON
  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (err) {
    const error = new Error(`Failed to parse router JSON: ${err.message}`);
    error.rawJson = response.text;
    throw error;
  }

  // Validate with Zod
  try {
    return RouterOutputSchema.parse(parsed);
  } catch (err) {
    const error = new Error(`Router validation failed: ${err.message}`);
    error.rawJson = response.text;
    error.validationError = err;
    throw error;
  }
}

/**
 * Attempt to repair invalid JSON
 */
async function attemptRouterRepair(provider, invalidJson, validationError) {
  const systemPrompt = getRepairSystemPrompt();
  const userPrompt = getRepairUserPrompt(
    invalidJson || 'See validation error below',
    validationError.message
  );

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }
  );

  const parsed = JSON.parse(response.text);
  return RouterOutputSchema.parse(parsed);
}

module.exports = { runRouter };
