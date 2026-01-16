/**
 * Response Contract Validation
 */

const REQUIRED_SECTIONS = [
  '## Immediate Actions',
  '## Likely Causes',
  '## Cost & Effort Range',
  '## What Changes the Price',
  '## Hiring & Next Steps',
  "## Red Flags & Don'ts",
  '## Clarifying Questions',
];

function validateResponseContract(markdown) {
  const missingSections = [];
  const presentSections = [];

  for (const section of REQUIRED_SECTIONS) {
    if (markdown.includes(section)) {
      presentSections.push(section);
    } else {
      missingSections.push(section);
    }
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    presentSections,
  };
}

function formatValidationWarning(validation) {
  if (validation.valid) return '';

  return `\n\n---\n**⚠️ INTERNAL WARNING: Response missing required sections:**\n${validation.missingSections.map(s => `- ${s}`).join('\n')}\n---`;
}

module.exports = {
  REQUIRED_SECTIONS,
  validateResponseContract,
  formatValidationWarning,
};
