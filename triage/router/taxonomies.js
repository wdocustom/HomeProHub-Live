/**
 * Domain, Decision, Risk, and Posture Taxonomies
 */

const DOMAINS = [
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
];

const DECISION_TYPES = [
  'diagnose',
  'estimate_cost',
  'hire_contractor',
  'DIY_steps',
  'permit_code',
  'product_recommendation',
  'comparison',
  'planning',
];

const RISK_LEVELS = ['low', 'medium', 'high'];

const POSTURES = ['explainer', 'triager', 'risk_manager', 'optimizer'];

// Risk Keywords
const RISK_KEYWORDS = {
  high: [
    // Electrical hazards
    'fire', 'burning', 'smoke', 'spark', 'arc', 'shock', 'electrocuted', 'breaker trip', 'electrical fire',
    // Gas hazards
    'gas', 'gas leak', 'smell gas', 'propane', 'natural gas', 'carbon monoxide',
    // Structural
    'collapse', 'crack', 'foundation', 'sagging', 'structural', 'settling', 'movement', 'sinking',
    // Mold/toxins
    'mold', 'black mold', 'asbestos', 'lead', 'toxic', 'poisoning',
    // Water/flood
    'flood', 'flooding', 'water damage', 'standing water',
  ],
  medium: [
    'leak', 'leaking', 'drip', 'moisture', 'damp', 'condensation',
    'hvac', 'furnace', 'heating', 'cooling', 'ventilation',
    'sewer', 'backup',
  ],
};

/**
 * Calculate risk score based on keywords
 */
function calculateRiskScore(message) {
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

  return 'low';
}

/**
 * Get postures for risk level
 */
function getPosturesForRisk(riskLevel) {
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

module.exports = {
  DOMAINS,
  DECISION_TYPES,
  RISK_LEVELS,
  POSTURES,
  RISK_KEYWORDS,
  calculateRiskScore,
  getPosturesForRisk,
};
