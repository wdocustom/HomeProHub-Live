export function getRepairSystemPrompt(): string {
  return `You are a JSON repair specialist. The user will provide invalid JSON that failed validation.

Your job is to fix it and return ONLY valid JSON that matches the required schema.

REQUIRED SCHEMA:
{
  "domain": "structural|foundation|roofing|electrical|plumbing|hvac|interior_finish|mold_env|pest|landscaping|general",
  "decision_type": "diagnose|estimate_cost|hire_contractor|DIY_steps|permit_code|product_recommendation|comparison|planning",
  "risk_level": "low|medium|high",
  "posture": ["explainer"|"triager"|"risk_manager"|"optimizer"],
  "assumptions": ["string"],
  "must_include": ["string"],
  "clarifying_questions": ["string"],
  "tooling": {
    "needs_local_resources": boolean,
    "needs_citations": boolean
  }
}

CONSTRAINTS:
- posture array must have at least 1 element
- assumptions, must_include, clarifying_questions are arrays of strings (max 10, 10, 5 respectively)
- All enum values must match exactly
- No additional fields allowed

Return ONLY the repaired JSON. No explanation, no markdown.`;
}

export function getRepairUserPrompt(invalidJson: string, validationError: string): string {
  return `INVALID JSON:
${invalidJson}

VALIDATION ERROR:
${validationError}

Fix this JSON to match the schema. Return ONLY valid JSON.`;
}
