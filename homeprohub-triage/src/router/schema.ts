import { z } from 'zod';
import { DOMAINS, DECISION_TYPES, RISK_LEVELS, POSTURES } from './taxonomies';

export const RouterOutputSchema = z.object({
  domain: z.enum(DOMAINS),
  decision_type: z.enum(DECISION_TYPES),
  risk_level: z.enum(RISK_LEVELS),
  posture: z.array(z.enum(POSTURES)).min(1),
  assumptions: z.array(z.string()).max(10),
  must_include: z.array(z.string()).max(10),
  clarifying_questions: z.array(z.string()).max(5),
  tooling: z.object({
    needs_local_resources: z.boolean(),
    needs_citations: z.boolean(),
  }),
});

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

// Safe default router output for fallback scenarios
export function getSafeDefaultRouterOutput(): RouterOutput {
  return {
    domain: 'general',
    decision_type: 'diagnose',
    risk_level: 'medium',
    posture: ['explainer', 'risk_manager'],
    assumptions: ['User needs general guidance'],
    must_include: ['Safety warnings', 'Recommendation to consult professional'],
    clarifying_questions: [],
    tooling: {
      needs_local_resources: false,
      needs_citations: false,
    },
  };
}
