import { RouterOutputSchema, getSafeDefaultRouterOutput } from '../src/router/schema';
import { validateResponseContract, REQUIRED_SECTIONS } from '../src/answer/contract';

describe('Router Output Validation', () => {
  test('validates correct router output', () => {
    const validOutput = {
      domain: 'electrical' as const,
      decision_type: 'diagnose' as const,
      risk_level: 'high' as const,
      posture: ['triager', 'risk_manager'] as const,
      assumptions: ['Breaker is tripping frequently'],
      must_include: ['Safety warnings', 'Professional inspection recommendation'],
      clarifying_questions: ['How often does the breaker trip?'],
      tooling: {
        needs_local_resources: true,
        needs_citations: false,
      },
    };

    const result = RouterOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  test('rejects invalid domain', () => {
    const invalidOutput = {
      domain: 'invalid_domain',
      decision_type: 'diagnose',
      risk_level: 'high',
      posture: ['explainer'],
      assumptions: [],
      must_include: [],
      clarifying_questions: [],
      tooling: {
        needs_local_resources: false,
        needs_citations: false,
      },
    };

    const result = RouterOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  test('rejects empty posture array', () => {
    const invalidOutput = {
      domain: 'electrical',
      decision_type: 'diagnose',
      risk_level: 'high',
      posture: [],
      assumptions: [],
      must_include: [],
      clarifying_questions: [],
      tooling: {
        needs_local_resources: false,
        needs_citations: false,
      },
    };

    const result = RouterOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  test('safe default router output is valid', () => {
    const defaultOutput = getSafeDefaultRouterOutput();
    const result = RouterOutputSchema.safeParse(defaultOutput);
    expect(result.success).toBe(true);
  });

  test('rejects too many clarifying questions', () => {
    const invalidOutput = {
      domain: 'plumbing',
      decision_type: 'diagnose',
      risk_level: 'medium',
      posture: ['explainer'],
      assumptions: [],
      must_include: [],
      clarifying_questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'], // Max is 5
      tooling: {
        needs_local_resources: false,
        needs_citations: false,
      },
    };

    const result = RouterOutputSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });
});

describe('Response Contract Validation', () => {
  test('validates complete response contract', () => {
    const markdown = `
## Immediate Actions
Check the breaker panel.

## Likely Causes
1. Overloaded circuit
2. Short circuit

## Cost & Effort Range
Professional: $200-500

## What Changes the Price
Number of circuits affected.

## Hiring & Next Steps
Hire a licensed electrician.

## Red Flags & Don'ts
Don't attempt DIY electrical work.

## Clarifying Questions
1. How old is your home?
    `;

    const validation = validateResponseContract(markdown);
    expect(validation.valid).toBe(true);
    expect(validation.missingSections).toHaveLength(0);
    expect(validation.presentSections).toHaveLength(REQUIRED_SECTIONS.length);
  });

  test('detects missing sections', () => {
    const markdown = `
## Immediate Actions
Check the breaker panel.

## Likely Causes
1. Overloaded circuit

## Cost & Effort Range
Professional: $200-500
    `;

    const validation = validateResponseContract(markdown);
    expect(validation.valid).toBe(false);
    expect(validation.missingSections.length).toBeGreaterThan(0);
    expect(validation.missingSections).toContain('## What Changes the Price');
  });

  test('validates all required sections are present', () => {
    const markdown = REQUIRED_SECTIONS.join('\n\n');
    const validation = validateResponseContract(markdown);
    expect(validation.valid).toBe(true);
  });
});
