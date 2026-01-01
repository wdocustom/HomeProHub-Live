import { LLMProvider, LLMMessage, LLMOptions, LLMResponse } from '../src/types';
import { runRouter } from '../src/router/router';
import { runAnswer } from '../src/answer/answer';
import { validateResponseContract } from '../src/answer/contract';

// Mock provider for testing
class MockProvider implements LLMProvider {
  private responses: Map<string, string>;

  constructor() {
    this.responses = new Map();
  }

  setResponse(key: string, response: string) {
    this.responses.set(key, response);
  }

  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    // Determine if this is router or answer based on presence of JSON format
    const isRouter = options?.response_format?.type === 'json_object';

    if (isRouter) {
      const routerResponse = this.responses.get('router') || JSON.stringify({
        domain: 'electrical',
        decision_type: 'diagnose',
        risk_level: 'high',
        posture: ['triager', 'risk_manager'],
        assumptions: ['Electrical issue present'],
        must_include: ['Safety warnings'],
        clarifying_questions: ['When did this start?'],
        tooling: {
          needs_local_resources: true,
          needs_citations: false,
        },
      });

      return {
        text: routerResponse,
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };
    }

    // Answer response
    const answerResponse = this.responses.get('answer') || `
## Immediate Actions
Turn off power at the main breaker immediately.

## Likely Causes
1. Overloaded circuit - most common cause
2. Short circuit in wiring
3. Faulty appliance

## Cost & Effort Range
- Professional diagnosis: $150-300
- Circuit repair: $200-800
- Panel upgrade: $1,500-3,000

## What Changes the Price
- Number of circuits affected
- Age of home (older wiring more expensive)
- Accessibility of electrical panel
- Permit requirements in your area

## Hiring & Next Steps
Hire a licensed electrician immediately. This is not a DIY repair.

Questions to ask:
- Are you licensed and insured?
- What is your diagnostic fee?
- Do you provide written estimates?

## Red Flags & Don'ts
DO NOT attempt to repair yourself - electrical work requires licensed professional.
DO NOT ignore frequent tripping - this indicates a serious problem.
Warning: If you smell burning, evacuate and call fire department.

## Clarifying Questions
1. How often does the breaker trip?
2. Is it always the same circuit?
3. Have you added any new appliances recently?
4. How old is your electrical panel?
5. Do you smell any burning odors?
    `;

    return {
      text: answerResponse,
      usage: {
        prompt_tokens: 500,
        completion_tokens: 300,
        total_tokens: 800,
      },
    };
  }
}

describe('Integration: Full Triage Flow', () => {
  test('completes full router → answer flow with valid outputs', async () => {
    const provider = new MockProvider();
    const message = 'My circuit breaker keeps tripping';
    const context = { request_id: 'test-123' };

    // Run router
    const { output: routerOutput, retries } = await runRouter(
      provider,
      message,
      context
    );

    expect(routerOutput).toBeDefined();
    expect(routerOutput.domain).toBe('electrical');
    expect(routerOutput.risk_level).toBe('high');
    expect(retries).toBe(0);

    // Run answer
    const answerMarkdown = await runAnswer(
      provider,
      message,
      routerOutput,
      context
    );

    expect(answerMarkdown).toBeDefined();
    expect(answerMarkdown.length).toBeGreaterThan(0);

    // Validate contract
    const validation = validateResponseContract(answerMarkdown);
    expect(validation.valid).toBe(true);
    expect(validation.missingSections).toHaveLength(0);
  });

  test('handles router JSON repair on first failure', async () => {
    const provider = new MockProvider();

    // Set invalid JSON for first attempt
    provider.setResponse('router', '{ invalid json }');

    const message = 'Water leak in basement';
    const context = { request_id: 'test-456' };

    // This should trigger repair attempt and then fallback
    const { output: routerOutput, retries } = await runRouter(
      provider,
      message,
      context
    );

    expect(routerOutput).toBeDefined();
    expect(retries).toBeGreaterThan(0);
    // Should get safe default
    expect(routerOutput.domain).toBe('general');
    expect(routerOutput.posture).toContain('risk_manager');
  });

  test('validates all required sections are present in order', async () => {
    const provider = new MockProvider();
    const message = 'Test message';
    const context = { request_id: 'test-789' };

    const { output: routerOutput } = await runRouter(provider, message, context);
    const answerMarkdown = await runAnswer(
      provider,
      message,
      routerOutput,
      context
    );

    // Check each required section
    const sections = [
      '## Immediate Actions',
      '## Likely Causes',
      '## Cost & Effort Range',
      '## What Changes the Price',
      '## Hiring & Next Steps',
      '## Red Flags & Don\'ts',
      '## Clarifying Questions',
    ];

    sections.forEach(section => {
      expect(answerMarkdown).toContain(section);
    });

    // Verify sections appear in order
    let lastIndex = -1;
    for (const section of sections) {
      const index = answerMarkdown.indexOf(section);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  test('includes user context in prompts', async () => {
    const provider = new MockProvider();
    const message = 'HVAC not cooling';
    const context = { request_id: 'test-context' };
    const userContext = {
      location: 'Phoenix, AZ',
      yearBuilt: 1985,
      propertyType: 'single_family' as const,
      diyLevel: 'low' as const,
      budgetBand: 'medium' as const,
    };

    const { output: routerOutput } = await runRouter(
      provider,
      message,
      context,
      userContext
    );

    const answerMarkdown = await runAnswer(
      provider,
      message,
      routerOutput,
      context,
      userContext
    );

    expect(routerOutput).toBeDefined();
    expect(answerMarkdown).toBeDefined();
    // Context should influence the routing and answer
  });
});

describe('Integration: Error Handling', () => {
  test('falls back to safe default when router fails repeatedly', async () => {
    const provider = new MockProvider();
    // Set permanently invalid JSON
    provider.setResponse('router', 'completely invalid');

    const message = 'Test error handling';
    const context = { request_id: 'test-error' };

    const { output: routerOutput, retries } = await runRouter(
      provider,
      message,
      context
    );

    // Should get safe default
    expect(routerOutput.domain).toBe('general');
    expect(routerOutput.decision_type).toBe('diagnose');
    expect(routerOutput.posture).toContain('risk_manager');
    expect(retries).toBeGreaterThan(0);
  });
});
