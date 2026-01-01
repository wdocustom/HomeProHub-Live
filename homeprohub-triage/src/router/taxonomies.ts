// ===== Domain Taxonomy =====
export const DOMAINS = [
  'structural',
  'foundation',
  'roofing',
  'electrical',
  'plumbing',
  'hvac',
  'interior_finish',
  'mold_env',
  'pest',
  'landscaping',
  'general',
] as const;

export type Domain = (typeof DOMAINS)[number];

// ===== Decision Type Taxonomy =====
export const DECISION_TYPES = [
  'diagnose',
  'estimate_cost',
  'hire_contractor',
  'DIY_steps',
  'permit_code',
  'product_recommendation',
  'comparison',
  'planning',
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

// ===== Risk Levels =====
export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// ===== Postures =====
export const POSTURES = ['explainer', 'triager', 'risk_manager', 'optimizer'] as const;
export type Posture = (typeof POSTURES)[number];

// ===== Risk Scoring Heuristics =====

interface RiskKeywords {
  high: string[];
  medium: string[];
}

export const RISK_KEYWORDS: RiskKeywords = {
  high: [
    // Electrical hazards
    'fire',
    'burning',
    'smoke',
    'spark',
    'arc',
    'shock',
    'electrocuted',
    'breaker trip',
    'electrical fire',
    // Gas hazards
    'gas',
    'gas leak',
    'smell gas',
    'propane',
    'natural gas',
    'carbon monoxide',
    // Structural
    'collapse',
    'crack',
    'foundation',
    'sagging',
    'structural',
    'settling',
    'movement',
    'sinking',
    // Mold/toxins
    'mold',
    'black mold',
    'asbestos',
    'lead',
    'toxic',
    'poisoning',
    // Water/flood
    'flood',
    'flooding',
    'water damage',
    'standing water',
  ],
  medium: [
    'leak',
    'leaking',
    'drip',
    'moisture',
    'damp',
    'condensation',
    'hvac',
    'furnace',
    'heating',
    'cooling',
    'ventilation',
    'sewer',
    'backup',
  ],
};

export function calculateRiskScore(message: string): RiskLevel {
  const lowerMessage = message.toLowerCase();

  // Check high-risk keywords
  for (const keyword of RISK_KEYWORDS.high) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return 'high';
    }
  }

  // Check medium-risk keywords
  for (const keyword of RISK_KEYWORDS.medium) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return 'medium';
    }
  }

  // Default to low risk
  return 'low';
}

// ===== Posture Router =====

export function getPosturesForRisk(riskLevel: RiskLevel): Posture[] {
  switch (riskLevel) {
    case 'high':
      return ['triager', 'risk_manager'];
    case 'medium':
      return ['explainer', 'risk_manager'];
    case 'low':
      return ['explainer'];
    default:
      return ['explainer'];
  }
}
