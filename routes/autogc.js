/**
 * Auto-GC Access Control API
 *
 * Provides access control settings for Auto-GC features
 * to prevent dashboard crashes when checking feature access.
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/autogc/access-control
 *
 * Returns the current Auto-GC feature access settings
 *
 * Response:
 * {
 *   "ai_pricing": boolean,
 *   "plan_takeoffs": boolean,
 *   "auto_schedule": boolean
 * }
 */
router.get('/access-control', async (req, res) => {
  try {
    // Return default access control settings
    // These can be made dynamic in the future by checking user subscriptions
    const accessControl = {
      ai_pricing: true,
      plan_takeoffs: false,
      auto_schedule: true
    };

    res.json(accessControl);

  } catch (error) {
    console.error('Error fetching Auto-GC access control:', error);
    res.status(500).json({
      error: 'Failed to fetch access control settings',
      message: error.message
    });
  }
});

module.exports = router;
