// Response Contract - Required sections in order

export const REQUIRED_SECTIONS = [
  '## Immediate Actions',
  '## Likely Causes',
  '## Cost & Effort Range',
  '## What Changes the Price',
  '## Hiring & Next Steps',
  '## Red Flags & Don\'ts',
  '## Clarifying Questions',
] as const;

export interface ContractValidation {
  valid: boolean;
  missingSections: string[];
  presentSections: string[];
}

export function validateResponseContract(markdown: string): ContractValidation {
  const missingSections: string[] = [];
  const presentSections: string[] = [];

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

export function formatValidationWarning(validation: ContractValidation): string {
  if (validation.valid) return '';

  return `\n\n---\n**⚠️ INTERNAL WARNING: Response missing required sections:**\n${validation.missingSections.map(s => `- ${s}`).join('\n')}\n---`;
}
