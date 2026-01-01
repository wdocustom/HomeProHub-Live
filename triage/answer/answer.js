/**
 * Answer Generation
 */

const { getAnswerSystemPrompt, getAnswerUserPrompt } = require('../prompts/answer');
const { validateResponseContract, formatValidationWarning } = require('./contract');

/**
 * Run answer generation pass
 */
async function runAnswer(provider, message, routerOutput, userContext, mode = 'homeowner') {
  const systemPrompt = getAnswerSystemPrompt(mode);
  const userPrompt = getAnswerUserPrompt(message, routerOutput, userContext);

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.7,
      max_tokens: 3000,
    }
  );

  const markdown = response.text;

  // Validate response contract
  const validation = validateResponseContract(markdown);
  if (!validation.valid) {
    console.log('⚠ Answer missing sections:', validation.missingSections);
    const warning = formatValidationWarning(validation);
    return { markdown: markdown + warning, usage: response.usage, validation };
  }

  console.log('✓ Answer pass completed with all required sections');
  return { markdown, usage: response.usage, validation };
}

module.exports = { runAnswer };
