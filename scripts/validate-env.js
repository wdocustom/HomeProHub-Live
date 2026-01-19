#!/usr/bin/env node
/**
 * Pre-deployment Environment Validation Script
 * Ensures all critical environment variables are set before server starts
 *
 * Usage: node scripts/validate-env.js
 * Exit code: 0 = success, 1 = failure
 */

require('dotenv').config();

// Critical variables required for server operation
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

// Recommended variables (warnings only)
const RECOMMENDED_VARS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'BREVO_API_KEY',
  'STRIPE_SECRET_KEY'
];

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('Required variables:');
REQUIRED_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === '') {
    console.error(`  ❌ ${varName} - MISSING (CRITICAL)`);
    hasErrors = true;
  } else {
    // Show first 10 chars for verification
    const preview = value.substring(0, 10) + '...';
    console.log(`  ✅ ${varName} - ${preview}`);
  }
});

// Check recommended variables
console.log('\nRecommended variables:');
RECOMMENDED_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === '') {
    console.warn(`  ⚠️  ${varName} - Missing (functionality limited)`);
    hasWarnings = true;
  } else {
    const preview = value.substring(0, 10) + '...';
    console.log(`  ✅ ${varName} - ${preview}`);
  }
});

console.log('\n' + '─'.repeat(60));

if (hasErrors) {
  console.error('\n❌ VALIDATION FAILED');
  console.error('Missing required environment variables.');
  console.error('Set them in your environment or .env file before deploying.\n');
  process.exit(1);
}

if (hasWarnings) {
  console.warn('\n⚠️  VALIDATION PASSED WITH WARNINGS');
  console.warn('Some optional features may not work.\n');
  process.exit(0);
}

console.log('\n✅ VALIDATION PASSED');
console.log('All required environment variables are set.\n');
process.exit(0);
