/**
 * AI Check - Main Orchestrator
 * Photo-first homeowner diagnosis system
 */

const { runExtractor } = require('./extractor');
const { runGenerator } = require('./generator');

/**
 * Run AI Check - Complete 2-pass pipeline
 * @param {Object} provider - AI provider (Anthropic or OpenAI with vision support)
 * @param {string} textDescription - User's text description (optional)
 * @param {Array<{type: string, source: Object}>} images - Array of image content blocks (1-5)
 * @returns {Promise<{output: Object, metadata: Object}>}
 */
async function runAICheck(provider, textDescription = '', images = []) {
  const startTime = Date.now();
  const metadata = {
    request_id: generateRequestId(),
    timestamp: new Date().toISOString(),
    text_length: textDescription.length,
    image_count: images.length,
  };

  // Validate inputs
  if (!textDescription.trim() && images.length === 0) {
    throw new Error('At least one of textDescription or images must be provided');
  }

  if (images.length > 5) {
    throw new Error('Maximum 5 images allowed');
  }

  // PASS 1: Vision Extractor
  console.log(`[AI Check ${metadata.request_id}] PASS 1: Vision Extractor`);
  const extractorStart = Date.now();
  const { observation, retries: extractorRetries, rawResponse: extractorRaw } = await runExtractor(
    provider,
    textDescription,
    images
  );
  const extractorLatency = Date.now() - extractorStart;

  console.log(`[AI Check ${metadata.request_id}] Observation:`, observation);
  console.log(`[AI Check ${metadata.request_id}] Extractor retries: ${extractorRetries}`);

  // PASS 2: Generator
  console.log(`[AI Check ${metadata.request_id}] PASS 2: Generator`);
  const generatorStart = Date.now();
  const { output, retries: generatorRetries, rawResponse: generatorRaw } = await runGenerator(
    provider,
    observation,
    textDescription
  );
  const generatorLatency = Date.now() - generatorStart;

  console.log(`[AI Check ${metadata.request_id}] Output:`, output);
  console.log(`[AI Check ${metadata.request_id}] Generator retries: ${generatorRetries}`);

  // Total latency
  const totalLatency = Date.now() - startTime;

  // Build metadata
  metadata.extractor_latency_ms = extractorLatency;
  metadata.generator_latency_ms = generatorLatency;
  metadata.total_latency_ms = totalLatency;
  metadata.extractor_retries = extractorRetries;
  metadata.generator_retries = generatorRetries;
  metadata.observation = observation;
  metadata.confidence = output.confidence;
  metadata.primary_trade = output.who_to_call.primary_trade;
  metadata.diy_level = output.diy_level;
  metadata.cost_tier = output.cost_tier.tier;
  metadata.safety_flags = output.safety_flags;

  console.log(
    `[AI Check ${metadata.request_id}] ✓ Complete in ${totalLatency}ms (${extractorLatency}ms + ${generatorLatency}ms)`
  );

  return {
    output,
    metadata,
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `aic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

module.exports = {
  runAICheck,
};
