#!/usr/bin/env node

/**
 * Zero-App Protocol Test Script
 * Tests the Twilio Ingestion Pipeline End-to-End
 *
 * This script:
 * 1. Seeds test data (contractor and job) - idempotently
 * 2. Simulates a Twilio webhook POST request
 * 3. Verifies the entry was created in field_logs
 */

require('dotenv').config();
const { supabase } = require('../database/db');
const fetch = require('node-fetch');

// Test configuration
const TEST_CONFIG = {
  contractor: {
    first_name: 'Mike',
    last_name: 'the Automator',
    email: 'test_contractor@example.com',
    mobile_phone: '+15550001',
    role: 'contractor',
    trade: 'electrical'
  },
  job: {
    title: 'AI Ingestion Test Project',
    description: 'Test project for Zero-App Protocol verification',
    project_phone_number: '+15559999',
    homeowner_email: 'camachoskyler@gmail.com',
    status: 'in_progress',
    address: '123 Test Street, Test City, CA 90210',
    category: 'electrical'
  },
  webhook: {
    From: '+15550001',
    To: '+15559999',
    Body: 'Electrical rough-in is complete. Wires are pulled and boxes are set.',
    NumMedia: '0'
  }
};

// API endpoint configuration
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const WEBHOOK_ENDPOINT = `${API_BASE}/api/webhooks/twilio/incoming`;

/**
 * Step 1: Seed Test Contractor (Idempotent)
 */
async function seedContractor() {
  console.log('\n🔧 [STEP 1] Seeding test contractor...');
  console.log(`   → Name: ${TEST_CONFIG.contractor.first_name} ${TEST_CONFIG.contractor.last_name}`);
  console.log(`   → Mobile: ${TEST_CONFIG.contractor.mobile_phone}`);
  console.log(`   → Email: ${TEST_CONFIG.contractor.email}`);

  try {
    // Upsert contractor (idempotent based on email)
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(TEST_CONFIG.contractor, {
        onConflict: 'email',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to seed contractor: ${error.message}`);
    }

    console.log(`   ✅ Contractor seeded successfully (ID: ${data.id})`);
    return data;
  } catch (error) {
    console.error(`   ❌ Error seeding contractor: ${error.message}`);
    throw error;
  }
}

/**
 * Step 2: Seed Test Job (Idempotent)
 */
async function seedJob() {
  console.log('\n📋 [STEP 2] Seeding test job...');
  console.log(`   → Title: ${TEST_CONFIG.job.title}`);
  console.log(`   → Project Phone: ${TEST_CONFIG.job.project_phone_number}`);
  console.log(`   → Homeowner: ${TEST_CONFIG.job.homeowner_email}`);

  try {
    // Check if job already exists with this project phone number
    const { data: existingJob } = await supabase
      .from('job_postings')
      .select('*')
      .eq('project_phone_number', TEST_CONFIG.job.project_phone_number)
      .single();

    let jobData;

    if (existingJob) {
      console.log(`   ⚠️  Job already exists (ID: ${existingJob.id}), updating...`);

      // Update existing job
      const { data, error } = await supabase
        .from('job_postings')
        .update({
          ...TEST_CONFIG.job,
          updated_at: new Date().toISOString()
        })
        .eq('project_phone_number', TEST_CONFIG.job.project_phone_number)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update job: ${error.message}`);
      }

      jobData = data;
    } else {
      // Create new job
      const { data, error } = await supabase
        .from('job_postings')
        .insert({
          ...TEST_CONFIG.job,
          posted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create job: ${error.message}`);
      }

      jobData = data;
    }

    console.log(`   ✅ Job seeded successfully (ID: ${jobData.id})`);
    return jobData;
  } catch (error) {
    console.error(`   ❌ Error seeding job: ${error.message}`);
    throw error;
  }
}

/**
 * Step 3: Simulate Twilio Webhook
 */
async function simulateWebhook() {
  console.log('\n📡 [STEP 3] Simulating Twilio webhook...');
  console.log(`   → Endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log(`   → From: ${TEST_CONFIG.webhook.From}`);
  console.log(`   → To: ${TEST_CONFIG.webhook.To}`);
  console.log(`   → Body: "${TEST_CONFIG.webhook.Body}"`);

  try {
    // Convert webhook data to URL-encoded format (as Twilio sends it)
    const formData = new URLSearchParams(TEST_CONFIG.webhook);

    const response = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const responseText = await response.text();

    console.log(`   → HTTP Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log(`   ✅ Webhook processed successfully`);
      console.log(`   → Response: ${responseText.substring(0, 100)}...`);
      return true;
    } else {
      console.error(`   ❌ Webhook failed with status ${response.status}`);
      console.error(`   → Response: ${responseText}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error simulating webhook: ${error.message}`);
    throw error;
  }
}

/**
 * Step 4: Verify Field Logs Entry
 */
async function verifyFieldLogs(jobId, contractorId) {
  console.log('\n🔍 [STEP 4] Verifying field_logs entry...');
  console.log(`   → Looking for entries with project_id=${jobId} and contractor_id=${contractorId}`);

  try {
    // Wait a moment for the webhook to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Query field_logs for the most recent entry matching our test
    const { data, error } = await supabase
      .from('field_logs')
      .select('*')
      .eq('project_id', jobId)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw new Error(`Failed to query field_logs: ${error.message}`);
    }

    console.log(`   → Found ${data.length} field_logs entries`);

    if (data.length === 0) {
      console.error('   ❌ No field_logs entries found! The Air Gap may not be working.');
      return false;
    }

    // Display the most recent entry
    const latestEntry = data[0];
    console.log('\n   ✅ SUCCESS! Latest field_logs entry:');
    console.log(`   ┌─────────────────────────────────────────────────────────`);
    console.log(`   │ ID: ${latestEntry.id}`);
    console.log(`   │ Project ID: ${latestEntry.project_id}`);
    console.log(`   │ Contractor ID: ${latestEntry.contractor_id}`);
    console.log(`   │ Content: "${latestEntry.content?.substring(0, 80)}..."`);
    console.log(`   │ Created: ${latestEntry.created_at}`);
    console.log(`   └─────────────────────────────────────────────────────────`);

    return true;
  } catch (error) {
    console.error(`   ❌ Error verifying field_logs: ${error.message}`);
    throw error;
  }
}

/**
 * Main Test Runner
 */
async function runTest() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       ZERO-APP PROTOCOL TEST - Twilio Ingestion         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ Test started at: ${new Date().toISOString()}`);

  try {
    // Step 1: Seed contractor
    const contractor = await seedContractor();

    // Step 2: Seed job
    const job = await seedJob();

    // Step 3: Simulate webhook
    const webhookSuccess = await simulateWebhook();

    if (!webhookSuccess) {
      throw new Error('Webhook simulation failed');
    }

    // Step 4: Verify field logs
    const verificationSuccess = await verifyFieldLogs(job.id, contractor.id);

    // Final summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');

    if (verificationSuccess) {
      console.log('║                    ✅ TEST PASSED                        ║');
      console.log('║                                                           ║');
      console.log('║   The Zero-App Protocol "Air Gap" is working correctly!  ║');
      console.log('║   Twilio webhook → field_logs → Success                  ║');
    } else {
      console.log('║                    ❌ TEST FAILED                        ║');
      console.log('║                                                           ║');
      console.log('║   The Air Gap is NOT working. Check logs above.          ║');
    }

    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`\n⏰ Test completed at: ${new Date().toISOString()}`);

    process.exit(verificationSuccess ? 0 : 1);
  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                  💥 TEST CRASHED                         ║');
    console.error('╚═══════════════════════════════════════════════════════════╝');
    console.error(`\nError: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test if executed directly
if (require.main === module) {
  runTest();
}

module.exports = { runTest, seedContractor, seedJob, simulateWebhook, verifyFieldLogs };
