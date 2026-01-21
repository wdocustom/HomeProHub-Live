/**
 * Webhook Routes - Zero-App Protocol
 * Handles Twilio webhooks for SMS, MMS, and Voice
 */

const express = require('express');
const router = express.Router();
const IngestionService = require('../services/IngestionService');

/**
 * POST /api/webhooks/twilio/incoming
 * Main webhook endpoint for all Twilio messages
 */
router.post('/twilio/incoming', express.urlencoded({ extended: false }), async (req, res) => {
  console.log('[Webhook] Incoming Twilio request');

  try {
    // Process with IngestionService
    const result = await IngestionService.handleIncoming(req.body);

    // Return empty TwiML response (200 OK stops Twilio retries)
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    // Log result (after response sent)
    if (result.success) {
      console.log(`[Webhook] Success: ${result.summary}`);
    } else {
      console.error('[Webhook] Processing failed:', result.error);
    }

  } catch (error) {
    console.error('[Webhook] Fatal error:', error);

    // Still return 200 to stop Twilio retries
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * GET /api/webhooks/twilio/status
 * Status callback for message delivery (optional)
 */
router.post('/twilio/status', express.urlencoded({ extended: false }), async (req, res) => {
  console.log('[Webhook] Message status update:', {
    MessageSid: req.body.MessageSid,
    MessageStatus: req.body.MessageStatus
  });

  res.sendStatus(200);
});

module.exports = router;
