# Twilio Full Integration Plan for Auto-GC System

## Current Status

### ✅ Already Implemented

1. **SMS Outbound (DiplomatAgent)**
   - `DiplomatAgent.sendSMS()` - Send SMS to contractors
   - `DiplomatAgent.sendVerificationLink()` - Send verification links
   - Location: `services/universalAgentServices.js:1181-1266`

2. **SMS Inbound (Webhook Handler)**
   - Endpoint: `POST /api/webhooks/incoming-sms`
   - Handles contractor replies
   - Routes messages to projects
   - Parses intent (milestone claims, progress updates, blockers)
   - Location: `server.js:7944-8121`

3. **Notification Worker**
   - Background process for queued notifications
   - SMS delivery tracking
   - Location: `services/notification-worker.js`

4. **Database Schema**
   - `sms_routing_log` - SMS conversation history
   - `notification_log` - Delivery tracking
   - `verification_tokens` - Token management

### ❌ Not Implemented (Yet)

1. **Voice Calls** - No inbound/outbound voice capability
2. **IVR (Interactive Voice Response)** - No phone menu system
3. **Call Recording** - No recording or transcription
4. **Voice Broadcasts** - No mass calling
5. **SMS Templates** - No message templates
6. **Two-Way SMS Conversations** - Limited conversational AI
7. **MMS (Picture Messages)** - No image support
8. **WhatsApp Integration** - Not configured

---

## Twilio Features & Use Cases for Auto-GC

### 1. **Programmable Voice** 🎙️

#### Use Cases:
- **Contractor Onboarding Calls** - Welcome call when they join
- **Emergency Notifications** - Call contractors for urgent project needs
- **Automated Status Updates** - "Your milestone was approved"
- **IVR Menu System** - Press 1 for projects, 2 for support, etc.
- **Call Recording** - Record contractor phone conversations for quality
- **Voicemail Detection** - Leave automated voicemails

#### Twilio Dashboard Setup:
1. **Buy Voice-Enabled Number**
   - Console → Phone Numbers → Buy a Number
   - Select "Voice" capability
   - Choose local or toll-free number

2. **Configure Voice Webhook**
   - Phone Numbers → Manage → Active Numbers → Select your number
   - Voice & Fax section:
     - **A CALL COMES IN**: Webhook → `https://homeprohub.today/api/webhooks/incoming-call`
     - HTTP POST
   - **CALL STATUS CHANGES**: `https://homeprohub.today/api/webhooks/call-status`

3. **Enable Call Recording** (Optional)
   - Settings → Voice → Call Recording → Enable

#### Code Implementation:

```javascript
// server.js - Voice webhook handlers

/**
 * POST /api/webhooks/incoming-call
 * Handle incoming voice calls from contractors
 */
app.post('/api/webhooks/incoming-call', (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const response = new VoiceResponse();

  const { From, To, CallSid } = req.body;

  console.log(`[Voice] Incoming call from ${From}, CallSid: ${CallSid}`);

  // IVR Menu
  const gather = response.gather({
    numDigits: 1,
    action: '/api/webhooks/voice-menu',
    method: 'POST'
  });

  gather.say(
    'Welcome to HomeProHub. ' +
    'Press 1 for active project status. ' +
    'Press 2 to speak with support. ' +
    'Press 3 to update your availability.'
  );

  // If no input, repeat
  response.redirect('/api/webhooks/incoming-call');

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * POST /api/webhooks/voice-menu
 * Handle IVR menu selections
 */
app.post('/api/webhooks/voice-menu', async (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const response = new VoiceResponse();

  const { Digits, From, CallSid } = req.body;

  console.log(`[Voice] Menu selection: ${Digits} from ${From}`);

  switch (Digits) {
    case '1': // Project Status
      // Look up contractor's active projects
      const contractor = await db.query(
        'SELECT * FROM user_profiles WHERE phone = $1',
        [From]
      );

      if (contractor.rows.length > 0) {
        const projects = await db.query(
          'SELECT COUNT(*) as count FROM contractor_project_assignments WHERE contractor_id = $1 AND status = $2',
          [contractor.rows[0].id, 'active']
        );

        response.say(`You have ${projects.rows[0].count} active projects.`);
        response.say('Check your phone for SMS details.');

        // Send SMS with project details
        const { DiplomatAgent } = require('./services/universalAgentServices');
        await DiplomatAgent.sendSMS(
          From,
          `Active Projects: ${projects.rows[0].count}\nCheck contractor-tools.html for details.`
        );
      } else {
        response.say('We could not find your contractor account.');
      }
      break;

    case '2': // Support
      response.say('Transferring you to support. Please hold.');
      response.dial('+1-555-SUPPORT'); // Your support number
      break;

    case '3': // Update Availability
      response.say('Thank you. We will send you an SMS to update your availability.');
      // Send SMS with availability update link
      break;

    default:
      response.say('Invalid selection. Please try again.');
      response.redirect('/api/webhooks/incoming-call');
  }

  response.say('Thank you for calling HomeProHub. Goodbye.');
  response.hangup();

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * POST /api/webhooks/call-status
 * Track call completion, duration, recording URL
 */
app.post('/api/webhooks/call-status', async (req, res) => {
  const {
    CallSid,
    CallStatus,
    CallDuration,
    RecordingUrl,
    From,
    To
  } = req.body;

  console.log(`[Voice] Call ${CallSid} status: ${CallStatus}, duration: ${CallDuration}s`);

  // Log call to database
  await db.query(`
    INSERT INTO call_log (
      call_sid, from_phone, to_phone, status, duration_seconds,
      recording_url, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (call_sid) DO UPDATE SET
      status = $4,
      duration_seconds = $5,
      recording_url = $6,
      updated_at = NOW()
  `, [CallSid, From, To, CallStatus, CallDuration || 0, RecordingUrl]);

  res.sendStatus(200);
});
```

**Database Migration for Voice:**

```sql
-- Add to database/migrations/add_voice_features.sql

CREATE TABLE IF NOT EXISTS call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Twilio data
  call_sid TEXT UNIQUE NOT NULL,
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,

  -- Call details
  status TEXT, -- queued, ringing, in-progress, completed, failed, busy, no-answer
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  transcription_text TEXT,

  -- Routing
  contractor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,

  -- Menu selections
  ivr_selections JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_call_log_from_phone ON call_log(from_phone);
CREATE INDEX idx_call_log_call_sid ON call_log(call_sid);
CREATE INDEX idx_call_log_contractor ON call_log(contractor_id);
CREATE INDEX idx_call_log_created_at ON call_log(created_at DESC);
```

---

### 2. **Outbound Calling** 📞

#### Use Cases:
- **Automated Milestone Reminders** - "Your deadline is tomorrow"
- **Payment Notifications** - "Invoice approved, payment processing"
- **Emergency Alerts** - "Job site emergency, call GC immediately"

#### Implementation:

```javascript
// services/universalAgentServices.js - Add to DiplomatAgent

/**
 * Make outbound call to contractor
 * @param {string} toPhone - Contractor phone number
 * @param {string} message - Message to speak (TTS)
 * @param {number} projectId - Project ID (optional)
 * @returns {Object} - Call result
 */
static async makeCall(toPhone, message, projectId = null) {
  console.log(`[Diplomat] Calling ${toPhone}...`);

  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Create TwiML for the call
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, message);
    twiml.hangup();

    // Make call
    const call = await client.calls.create({
      twiml: twiml.toString(),
      to: toPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `https://homeprohub.today/api/webhooks/call-status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed']
    });

    console.log(`[Diplomat] Call initiated: ${call.sid}`);

    // Log to database
    if (projectId) {
      await db.query(`
        INSERT INTO call_log (
          call_sid, from_phone, to_phone, status,
          contractor_id, project_id
        )
        VALUES ($1, $2, $3, $4,
          (SELECT id FROM user_profiles WHERE phone = $3 LIMIT 1),
          $5
        )
      `, [
        call.sid,
        process.env.TWILIO_PHONE_NUMBER,
        toPhone,
        'initiated',
        projectId
      ]);
    }

    return {
      success: true,
      call_sid: call.sid,
      status: call.status
    };

  } catch (error) {
    console.error('[Diplomat] Error making call:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Usage Example:**

```javascript
// When milestone is 24 hours overdue
const { DiplomatAgent } = require('./services/universalAgentServices');

await DiplomatAgent.makeCall(
  contractorPhone,
  'Hello from HomeProHub. Your milestone for kitchen electrical work is overdue. ' +
  'Please check your dashboard or reply via SMS for assistance. Thank you.',
  projectId
);
```

---

### 3. **SMS Templates & Rich Messaging** 💬

#### Twilio Dashboard Setup:
1. **Create Content Templates** (Approved for A2P 10DLC)
   - Console → Messaging → Content Templates
   - Create template: "Milestone Reminder"
   - Variables: `{{contractor_name}}`, `{{milestone_name}}`, `{{deadline}}`

#### Implementation:

```javascript
// services/smsTemplates.js (NEW FILE)

module.exports = {
  milestoneReminder: (contractorName, milestoneName, deadline) => `
🏗️ Milestone Reminder

Hi ${contractorName},

Your milestone "${milestoneName}" is due on ${deadline}.

Reply:
• DONE - Mark complete
• HELP - Request assistance
• DELAY - Report blocker

- HomeProHub Team
  `.trim(),

  milestoneApproved: (contractorName, milestoneName, amount) => `
✅ Milestone Approved!

Hi ${contractorName},

Your milestone "${milestoneName}" has been approved!

💰 Payment: $${amount}
⏱️ Processing: 2-3 business days

Check dashboard for details.

- HomeProHub
  `.trim(),

  newProjectAssignment: (contractorName, projectTitle, gcName, dueDate) => `
🆕 New Project Assignment

Hi ${contractorName},

${gcName} has assigned you to:
"${projectTitle}"

📅 Due: ${dueDate}

👉 View details: https://homeprohub.today/contractor-tools.html

Reply YES to confirm or CALL for questions.
  `.trim(),

  emergencyAlert: (contractorName, projectAddress, issueDescription) => `
🚨 URGENT: Job Site Alert

${contractorName},

Issue at ${projectAddress}:
${issueDescription}

🔴 IMMEDIATE RESPONSE REQUIRED

Call GC or visit site ASAP.

- HomeProHub Emergency System
  `.trim()
};
```

**Update DiplomatAgent to use templates:**

```javascript
// services/universalAgentServices.js

const smsTemplates = require('./smsTemplates');

static async sendMilestoneReminder(contractorId, milestoneId) {
  // Fetch milestone and contractor details
  const milestone = await db.query(
    'SELECT * FROM project_milestones WHERE id = $1',
    [milestoneId]
  );

  const contractor = await db.query(
    'SELECT * FROM user_profiles WHERE id = $1',
    [contractorId]
  );

  const message = smsTemplates.milestoneReminder(
    contractor.rows[0].first_name,
    milestone.rows[0].milestone_name,
    new Date(milestone.rows[0].deadline).toLocaleDateString()
  );

  return await this.sendSMS(
    contractor.rows[0].phone,
    message,
    milestone.rows[0].project_id
  );
}
```

---

### 4. **MMS (Picture Messaging)** 📷

#### Use Cases:
- **Blueprint Sharing** - Send blueprint thumbnails to contractors
- **Photo Verification** - Contractors send milestone photos via MMS
- **Marketing** - Send branded project completion photos

#### Implementation:

```javascript
// DiplomatAgent - Send MMS

static async sendMMS(toPhone, body, mediaUrl, projectId = null) {
  console.log(`[Diplomat] Sending MMS to ${toPhone}...`);

  try {
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone,
      mediaUrl: [mediaUrl] // Array of image URLs
    });

    console.log(`[Diplomat] MMS sent: ${message.sid}`);

    return {
      success: true,
      message_sid: message.sid
    };

  } catch (error) {
    console.error('[Diplomat] MMS error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Usage:**

```javascript
// Send blueprint thumbnail to contractor
await DiplomatAgent.sendMMS(
  contractorPhone,
  '📐 Blueprint for your review',
  'https://homeprohub.today/uploads/blueprints/kitchen-thumb.jpg',
  projectId
);
```

**Handle Incoming MMS (Photos from Contractors):**

```javascript
// server.js - Update incoming SMS webhook

app.post('/api/webhooks/incoming-sms', express.urlencoded({ extended: false }), async (req, res) => {
  const { From, Body, MessageSid, NumMedia } = req.body;

  // Check if MMS (has media)
  if (parseInt(NumMedia) > 0) {
    const mediaUrls = [];
    for (let i = 0; i < parseInt(NumMedia); i++) {
      const mediaUrl = req.body[`MediaUrl${i}`];
      const mediaType = req.body[`MediaContentType${i}`];

      mediaUrls.push({ url: mediaUrl, type: mediaType });
    }

    console.log(`[Webhook] MMS received from ${From} with ${NumMedia} images`);

    // Store photos as milestone evidence
    // ... (integrate with SentinelAgent for verification)
  }

  // ... rest of SMS handling
});
```

---

### 5. **Advanced SMS Features** ✨

#### A. **Two-Way Conversational AI**

Use OpenAI to understand contractor replies:

```javascript
// services/universalAgentServices.js - Update DiplomatAgent

static async parseContractorReply(messageBody, contractorId, projectId) {
  console.log('[Diplomat] Parsing contractor reply with AI...');

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Get project context
  const project = await db.query(
    'SELECT * FROM job_postings WHERE id = $1',
    [projectId]
  );

  const prompt = `
You are HomeProHub's Auto-GC AI assistant. Analyze this SMS from a contractor.

Project: ${project.rows[0]?.title || 'Unknown'}
Contractor Message: "${messageBody}"

Classify the intent and extract structured data.

Intent Options:
- milestone_complete: Contractor completed milestone
- milestone_blocked: Contractor hit a blocker
- availability_update: Contractor changed availability
- question: Contractor has a question
- confirmation: Confirming receipt/assignment
- request_materials: Needs materials delivered
- safety_concern: Safety issue on site
- other: Cannot classify

Response format (JSON):
{
  "intent": "milestone_complete|milestone_blocked|...",
  "confidence": 0.0-1.0,
  "entities": {
    "milestone_name": "extracted milestone if mentioned",
    "blocker_description": "issue description if applicable",
    "question_text": "extracted question",
    "urgency": "low|medium|high"
  },
  "suggested_response": "Auto-generated reply to contractor"
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  const parsed = JSON.parse(response.choices[0].message.content);

  console.log('[Diplomat] Intent:', parsed.intent, '- Confidence:', parsed.confidence);

  return parsed;
}
```

#### B. **Smart Auto-Responses**

```javascript
// Auto-respond to common patterns

static async handleIncomingSMS(from, body, messageSid) {
  // Route to contractor and project
  const routing = await this.routeSMSToProject(from);

  if (!routing.success) {
    // Unknown sender
    await this.sendSMS(
      from,
      'Hi! We don\'t recognize your number. Please contact support@homeprohub.today to register as a contractor.'
    );
    return;
  }

  // Parse with AI
  const parsed = await this.parseContractorReply(
    body,
    routing.contractor_id,
    routing.project_id
  );

  // Auto-handle based on intent
  switch (parsed.intent) {
    case 'milestone_complete':
      // Send verification link
      await this.sendVerificationLink(
        routing.project_id,
        parsed.entities.milestone_id,
        routing.contractor_id,
        null,
        from
      );
      break;

    case 'milestone_blocked':
      // Log blocker and notify GC
      await db.query(`
        INSERT INTO project_logs (
          project_id, log_type, description, created_by_agent
        ) VALUES ($1, 'blocker_reported', $2, 'diplomat')
      `, [routing.project_id, parsed.entities.blocker_description]);

      await this.sendSMS(
        from,
        'We\'ve logged your blocker and notified the GC. They\'ll respond within 2 hours.'
      );
      break;

    case 'question':
      // Forward to GC and acknowledge
      await this.sendSMS(
        from,
        'Your question has been forwarded to the GC. You\'ll get a response soon. For urgent issues, call directly.'
      );
      break;

    default:
      // AI-generated response
      await this.sendSMS(from, parsed.suggested_response);
  }
}
```

---

### 6. **WhatsApp Integration** 📱

#### Twilio Dashboard Setup:
1. **Enable WhatsApp Sandbox** (Testing)
   - Console → Messaging → Try it out → Try WhatsApp
   - Send "join <your-code>" to Twilio WhatsApp number

2. **WhatsApp Business API** (Production)
   - Apply for WhatsApp Business API access
   - Requires Facebook Business Manager approval

#### Implementation:

```javascript
// Send WhatsApp message (same API as SMS)

await client.messages.create({
  body: 'Your milestone was approved! ✅',
  from: 'whatsapp:+14155238886', // Twilio WhatsApp number
  to: 'whatsapp:+15555555555'    // Contractor WhatsApp
});
```

---

## Twilio Dashboard Configuration Checklist

### Phone Number Setup
- [ ] Buy phone number with Voice + SMS capability
- [ ] Configure voice webhook: `https://homeprohub.today/api/webhooks/incoming-call`
- [ ] Configure SMS webhook: `https://homeprohub.today/api/webhooks/incoming-sms` (already done)
- [ ] Enable call recording (optional)
- [ ] Enable call forwarding (optional)

### Messaging Settings
- [ ] Register for A2P 10DLC (for high-volume SMS in US)
  - Console → Messaging → Regulatory Compliance
  - Submit business information
  - Register campaign use case
- [ ] Create message templates (if using A2P)
- [ ] Enable MMS (Picture Messaging)
- [ ] Set up WhatsApp sandbox (testing)
- [ ] Apply for WhatsApp Business API (production)

### Voice Settings
- [ ] Configure TwiML Bin for IVR menu (or use webhooks)
- [ ] Set up call recording storage (S3, Twilio, etc.)
- [ ] Enable voicemail detection
- [ ] Configure caller ID name (CNAM)

### Advanced Features
- [ ] Enable Programmable Chat (for in-app messaging)
- [ ] Set up Studio Flow (visual IVR builder)
- [ ] Configure SIP trunking (if integrating with PBX)
- [ ] Set up Autopilot (conversational AI bot)

### Monitoring & Analytics
- [ ] Set up usage alerts (spend limits)
- [ ] Configure error monitoring webhooks
- [ ] Enable detailed call/SMS logs
- [ ] Set up Twilio Console alerts

---

## Implementation Phases

### Phase 1: Voice Basics (1-2 weeks)
- [ ] Add voice webhook handlers
- [ ] Create IVR menu system
- [ ] Implement call logging
- [ ] Test inbound/outbound calls
- [ ] Database migration for call_log table

### Phase 2: SMS Enhancements (1 week)
- [ ] Create SMS templates
- [ ] Implement MMS support
- [ ] Add AI-powered reply parsing
- [ ] Build auto-response system
- [ ] Test with real contractors

### Phase 3: Advanced Features (2-3 weeks)
- [ ] WhatsApp integration
- [ ] Call recording & transcription
- [ ] Voicemail detection
- [ ] Voice broadcast system
- [ ] Conversational AI bot

### Phase 4: Testing & Optimization (1 week)
- [ ] End-to-end testing
- [ ] Load testing (100+ concurrent calls/SMS)
- [ ] Cost optimization
- [ ] Security audit
- [ ] Documentation

---

## Cost Estimates (US)

### Voice
- **Inbound calls**: $0.0085/min
- **Outbound calls**: $0.013/min
- **Recording**: $0.0025/min
- **Transcription**: $0.05/min

### SMS
- **Outbound SMS**: $0.0079/message
- **Inbound SMS**: $0.0079/message
- **MMS**: $0.02/message

### WhatsApp
- **Business-initiated**: $0.005-0.04/message (varies by country)
- **User-initiated response**: Free (within 24hr window)

### Monthly Cost Example:
- 1000 SMS/month: $15.80
- 500 minutes voice: $9.25
- 100 MMS: $2.00
- **Total: ~$27/month** for moderate usage

---

## Security Best Practices

1. **Validate Twilio Webhooks**
   ```javascript
   const twilio = require('twilio');

   app.post('/api/webhooks/incoming-sms', (req, res) => {
     const signature = req.headers['x-twilio-signature'];
     const url = `https://homeprohub.today${req.originalUrl}`;

     const valid = twilio.validateRequest(
       process.env.TWILIO_AUTH_TOKEN,
       signature,
       url,
       req.body
     );

     if (!valid) {
       return res.status(403).send('Forbidden');
     }

     // Process webhook...
   });
   ```

2. **Rate Limiting**
   - Limit SMS per contractor (e.g., 10/hour)
   - Prevent spam/abuse

3. **PII Protection**
   - Never log full phone numbers in plain text
   - Mask sensitive data in logs
   - Encrypt recordings at rest

4. **Compliance**
   - TCPA compliance (contractor opt-in required)
   - GDPR compliance (data retention policies)
   - A2P 10DLC registration (required for business SMS in US)

---

## Next Steps

1. **Immediate**: Add voice webhook handlers (Phase 1)
2. **Short-term**: SMS templates and MMS support (Phase 2)
3. **Long-term**: WhatsApp and advanced AI features (Phase 3)

Would you like me to start implementing any specific phase?
