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
    .min(20)
    .max(200)
    .describe('One calm sentence: "This looks like X, typically caused by Y"'),

  likely_causes: z
    .array(
      z.object({
        cause: z.string().max(100),
        confidence: z.enum(['high', 'medium', 'low']),
      })
    )
    .min(1)
    .max(3)
    .describe('Ranked probable causes'),

  do_now: z
    .array(z.string().max(100))
    .max(3)
    .describe('Immediate safe actions (turn off water, avoid area, etc.)'),

  dont_do: z
    .array(z.string().max(100))
    .max(3)
    .describe('What NOT to do (common mistakes)'),

  diy_level: z
    .enum(['safe_to_diy', 'inspection_only', 'pro_recommended', 'urgent'])
    .describe('DIY vs Pro routing'),

  who_to_call: z.object({
    primary_trade: z
      .enum([
        'general_contractor',
        'plumber',
        'electrician',
        'roofer',
        'hvac',
        'handyman',
        'foundation_specialist',
        'mold_remediation',
        'pest_control',
        'other',
      ])
      .describe('Primary trade needed'),
    secondary_trades: z
      .array(z.string())
      .max(2)
      .optional()
      .describe('Additional trades if multi-discipline'),
  }),

  cost_tier: z.object({
    tier: z
      .enum(['under_500', '500_2k', '2k_10k', '10k_plus', 'unknown'])
      .describe('Ballpark cost range'),
    disclaimer: z
      .string()
      .max(150)
      .describe('Why this could vary (accessibility, materials, permits)'),
  }),

  one_question: z
    .string()
    .max(150)
    .nullable()
    .describe('ONE follow-up question that changes diagnosis. Null if none needed.'),

  cta: z.object({
    primary_action: z
      .enum(['browse_contractors', 'post_project', 'schedule_inspection', 'learn_more'])
      .describe('What should user do next'),
    button_text: z.string().max(50).describe('CTA button text'),
    route: z.string().max(100).describe('Where to send user (URL path or page name)'),
  }),

  pro_message: z
    .string()
    .max(300)
    .describe('Calm, helpful message for contractor browsing/matching'),

  confidence: z.enum(['low', 'medium', 'high']).describe('Overall diagnosis confidence'),

  safety_flags: z
    .array(
      z.enum([
        'electrical_hazard',
        'water_damage_active',
        'structural_concern',
        'mold_suspected',
        'gas_leak_possible',
        'fire_risk',
        'none',
      ])
    )
    .max(3)
    .describe('Safety warnings'),
});

module.exports = {
  ObservationSchema,
  OutputContractSchema,
};
