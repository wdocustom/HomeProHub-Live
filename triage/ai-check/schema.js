/**
 * AI Check Zod Schemas
 * Production-ready validation for vision-first diagnosis
 */

const { z } = require('zod');

// OBSERVATION Schema - Vision Extractor output
const ObservationSchema = z.object({
  visible_damage: z.array(z.string()).max(10).describe('List of visible issues'),
  materials_identified: z.array(z.string()).max(5).describe('Materials visible in photo'),
  location_context: z
    .string()
    .max(100)
    .describe('Where is this (bathroom, roof, basement, etc.)'),
  urgency_indicators: z
    .array(z.string())
    .max(5)
    .describe('Signs of immediate risk (water, electrical, structural)'),
  age_condition: z
    .enum(['new', 'recent', 'aging', 'deteriorated', 'unknown'])
    .describe('Apparent age/condition'),
  text_description_summary: z
    .string()
    .max(200)
    .optional()
    .describe('Summary of user text description if provided'),
});

// Output Contract Schema - Final AI Check output
const OutputContractSchema = z.object({
  summary: z
    .string()
    .min(50)
    .max(400)
    .describe('2-3 sentences: What this is, what caused it, what it means'),

  likely_causes: z
    .array(
      z.object({
        label: z.string().max(80).describe('Short cause name'),
        why: z.string().max(150).describe('One sentence explanation'),
        likelihood: z.enum(['most_likely', 'possible', 'less_likely']).describe('Probability ranking'),
      })
    )
    .min(2)
    .max(3)
    .describe('Ranked probable causes with explanations'),

  do_now: z
    .array(z.string().max(120))
    .min(1)
    .max(3)
    .describe('Immediate safe actions (turn off water, avoid area, etc.)'),

  dont_do: z
    .array(z.string().max(120))
    .min(2)
    .max(4)
    .describe('What NOT to do (common mistakes)'),

  diy_level: z
    .enum(['safe_to_diy', 'inspection_only', 'pro_recommended', 'urgent'])
    .describe('DIY vs Pro routing'),

  who_to_call: z.object({
    trade: z
      .enum([
        'general_contractor',
        'plumber',
        'electrician',
        'roofer',
        'hvac',
        'handyman',
        'foundation',
        'mold_remediation',
      ])
      .describe('Primary trade needed'),
    why: z.string().max(150).describe('Why this trade is needed'),
  }),

  cost_tier: z.object({
    tier: z
      .enum(['low', 'medium', 'high', 'unknown'])
      .describe('Ballpark cost range: low (<$500), medium ($500-5k), high (>$5k), unknown'),
    drivers: z
      .array(z.string().max(100))
      .min(2)
      .max(4)
      .describe('What affects the cost (accessibility, materials, permits, etc.)'),
  }),

  one_question: z
    .string()
    .max(150)
    .nullable()
    .describe('ONE follow-up question that changes diagnosis. Null if none needed.'),

  cta: z.object({
    primary: z.object({
      label: z.string().max(50).describe('Primary CTA button text'),
      action: z
        .enum(['browse_contractors', 'get_matched', 'request_quote', 'save_report'])
        .describe('Primary action'),
    }),
    secondary: z
      .object({
        label: z.string().max(50).describe('Secondary CTA button text'),
        action: z.string().max(50).nullable().describe('Secondary action or null'),
      })
      .nullable()
      .describe('Optional secondary CTA'),
  }),

  pro_message: z
    .string()
    .min(100)
    .max(500)
    .describe('3-6 sentences: What to tell contractor, what to expect, copy/paste ready'),

  confidence: z.enum(['low', 'medium', 'high']).describe('Overall diagnosis confidence'),

  safety_flags: z
    .array(z.string().max(50))
    .max(5)
    .describe('Safety warnings (plain text, e.g. "Active water damage", "Electrical hazard")'),
});

module.exports = {
  ObservationSchema,
  OutputContractSchema,
};
