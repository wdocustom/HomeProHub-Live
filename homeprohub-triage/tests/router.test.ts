import { calculateRiskScore, getPosturesForRisk, RISK_KEYWORDS } from '../src/router/taxonomies';

describe('Risk Scoring Heuristics', () => {
  test('detects high-risk electrical keywords', () => {
    const messages = [
      'I smell burning from my electrical panel',
      'There are sparks coming from the outlet',
      'I got an electrical shock',
      'The breaker keeps tripping and I smell smoke',
    ];

    messages.forEach(msg => {
      const risk = calculateRiskScore(msg);
      expect(risk).toBe('high');
    });
  });

  test('detects high-risk gas keywords', () => {
    const messages = [
      'I smell gas in my kitchen',
      'Gas leak detected',
      'Carbon monoxide alarm going off',
    ];

    messages.forEach(msg => {
      const risk = calculateRiskScore(msg);
      expect(risk).toBe('high');
    });
  });

  test('detects high-risk structural keywords', () => {
    const messages = [
      'Large crack in foundation',
      'Floor is sagging',
      'Structural movement in walls',
      'House settling rapidly',
    ];

    messages.forEach(msg => {
      const risk = calculateRiskScore(msg);
      expect(risk).toBe('high');
    });
  });

  test('detects medium-risk keywords', () => {
    const messages = [
      'Water leaking from ceiling',
      'HVAC not working',
      'Furnace making noise',
      'Condensation on windows',
    ];

    messages.forEach(msg => {
      const risk = calculateRiskScore(msg);
      expect(risk).toBe('medium');
    });
  });

  test('defaults to low risk for cosmetic issues', () => {
    const messages = [
      'What color should I paint my living room?',
      'How to install new trim',
      'Best flooring for bedroom',
    ];

    messages.forEach(msg => {
      const risk = calculateRiskScore(msg);
      expect(risk).toBe('low');
    });
  });

  test('is case-insensitive', () => {
    expect(calculateRiskScore('ELECTRICAL FIRE')).toBe('high');
    expect(calculateRiskScore('electrical fire')).toBe('high');
    expect(calculateRiskScore('Electrical Fire')).toBe('high');
  });
});

describe('Posture Router', () => {
  test('high risk maps to triager + risk_manager', () => {
    const postures = getPosturesForRisk('high');
    expect(postures).toContain('triager');
    expect(postures).toContain('risk_manager');
    expect(postures).not.toContain('explainer');
  });

  test('medium risk maps to explainer + risk_manager', () => {
    const postures = getPosturesForRisk('medium');
    expect(postures).toContain('explainer');
    expect(postures).toContain('risk_manager');
    expect(postures).not.toContain('triager');
  });

  test('low risk maps to explainer only', () => {
    const postures = getPosturesForRisk('low');
    expect(postures).toContain('explainer');
    expect(postures).not.toContain('risk_manager');
    expect(postures).not.toContain('triager');
  });
});

describe('Risk Keyword Coverage', () => {
  test('has comprehensive electrical hazard keywords', () => {
    const electrical = ['fire', 'spark', 'shock', 'arc', 'burning'];
    electrical.forEach(keyword => {
      expect(RISK_KEYWORDS.high).toContainEqual(
        expect.stringContaining(keyword)
      );
    });
  });

  test('has comprehensive gas hazard keywords', () => {
    const gas = ['gas', 'carbon monoxide'];
    gas.forEach(keyword => {
      const hasKeyword = RISK_KEYWORDS.high.some(k =>
        k.toLowerCase().includes(keyword.toLowerCase())
      );
      expect(hasKeyword).toBe(true);
    });
  });

  test('has structural keywords', () => {
    const structural = ['foundation', 'crack', 'structural', 'collapse'];
    structural.forEach(keyword => {
      const hasKeyword = RISK_KEYWORDS.high.some(k =>
        k.toLowerCase().includes(keyword.toLowerCase())
      );
      expect(hasKeyword).toBe(true);
    });
  });
});
