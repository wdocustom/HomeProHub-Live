# Integration Guide

How to integrate HomeProHub Triage with your existing HomeProHub application.

## Option 1: Standalone Service (Recommended)

Run the triage service as a separate microservice and call it from your main application.

### Step 1: Start Triage Service

```bash
cd homeprohub-triage
npm install
npm run build
PORT=3001 npm start
```

### Step 2: Call from Main Server

In your existing `server.js`:

```javascript
// Add new endpoint to proxy to triage service
app.post('/api/ai/triage', async (req, res) => {
  try {
    const { question, context } = req.body;

    // Call triage service
    const triageResponse = await fetch('http://localhost:3001/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        context: {
          location: context?.location,
          yearBuilt: context?.yearBuilt,
          propertyType: context?.propertyType,
          diyLevel: context?.diyLevel || 'low',
          budgetBand: context?.budgetBand || 'unknown',
        },
        provider: 'openai', // or 'anthropic'
        mode: 'homeowner',
      }),
    });

    if (!triageResponse.ok) {
      throw new Error(`Triage service error: ${triageResponse.status}`);
    }

    const result = await triageResponse.json();

    // Return to frontend
    res.json({
      request_id: result.request_id,
      answer: result.answer_markdown,
      router: result.router,
      metadata: result.metadata,
    });

  } catch (error) {
    console.error('Triage error:', error);
    res.status(500).json({ error: 'Failed to process triage request' });
  }
});
```

### Step 3: Update Frontend

In your `preview.html` or wherever you call the AI endpoint:

```javascript
async function analyzeQuestion(question, context) {
  const response = await fetch('/api/ai/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });

  const data = await response.json();

  // Display the markdown answer
  displayAnswer(data.answer);

  // Optionally display router classification
  console.log('Router classification:', data.router);
}
```

## Option 2: Direct Integration (In-Process)

Import the triage logic directly into your Express server.

### Step 1: Install Dependencies

```bash
npm install zod openai @anthropic-ai/sdk winston
```

### Step 2: Copy Source Files

Copy the `src/` directory into your project:

```bash
cp -r homeprohub-triage/src ./triage
```

### Step 3: Add Endpoint to Your Server

```javascript
import { createProvider } from './triage/providers';
import { runRouter } from './triage/router/router';
import { runAnswer } from './triage/answer/answer';

app.post('/api/ai/triage', async (req, res) => {
  const requestId = uuidv4();

  try {
    const { message, context } = req.body;

    // Create providers
    const routerProvider = createProvider('openai', 'router');
    const answerProvider = createProvider('openai', 'answer');

    // Run router
    const { output: routerOutput } = await runRouter(
      routerProvider,
      message,
      { request_id: requestId },
      context
    );

    // Run answer
    const answerMarkdown = await runAnswer(
      answerProvider,
      message,
      routerOutput,
      { request_id: requestId },
      context,
      'homeowner'
    );

    res.json({
      request_id: requestId,
      answer: answerMarkdown,
      router: routerOutput,
    });

  } catch (error) {
    console.error('Triage error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Option 3: Replace Existing /api/ai/preview

Update your existing AI preview endpoint to use the triage system.

### Before (Current Code in server.js):

```javascript
app.post('/api/ai/preview', async (req, res) => {
  // ... existing single-pass Claude call
});
```

### After (With Triage System):

```javascript
app.post('/api/ai/preview', async (req, res) => {
  const requestId = uuidv4();

  try {
    const { question } = req.body;

    // Call triage service (or use direct integration)
    const triageResponse = await fetch('http://localhost:3001/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        provider: 'anthropic', // Use your preferred provider
        mode: 'homeowner',
      }),
    });

    const result = await triageResponse.json();

    // Return in format frontend expects
    res.json({
      answer: result.answer_markdown,
      // Include router metadata for debugging
      _router: result.router,
      _request_id: result.request_id,
    });

  } catch (error) {
    console.error('AI Preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});
```

## Frontend Updates

### Display Router Classification

Show users the risk level and domain detected:

```html
<div class="router-info">
  <span class="badge risk-${router.risk_level}">
    ${router.risk_level.toUpperCase()} RISK
  </span>
  <span class="badge">
    ${router.domain.replace('_', ' ').toUpperCase()}
  </span>
</div>
```

### Style Risk Levels

```css
.badge.risk-high {
  background-color: #dc2626;
  color: white;
}

.badge.risk-medium {
  background-color: #f59e0b;
  color: white;
}

.badge.risk-low {
  background-color: #10b981;
  color: white;
}
```

### Parse Markdown Sections

The answer is returned as markdown. Parse it to display sections separately:

```javascript
function parseAnswerSections(markdown) {
  const sections = {
    immediateActions: extractSection(markdown, '## Immediate Actions'),
    likelyCauses: extractSection(markdown, '## Likely Causes'),
    cost: extractSection(markdown, '## Cost & Effort Range'),
    priceFactors: extractSection(markdown, '## What Changes the Price'),
    hiring: extractSection(markdown, '## Hiring & Next Steps'),
    redFlags: extractSection(markdown, '## Red Flags & Don\'ts'),
    questions: extractSection(markdown, '## Clarifying Questions'),
  };
  return sections;
}

function extractSection(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return null;

  const nextHeading = markdown.indexOf('\n## ', start + heading.length);
  const end = nextHeading === -1 ? markdown.length : nextHeading;

  return markdown.substring(start + heading.length, end).trim();
}
```

## Production Deployment

### Docker (Recommended)

Create `Dockerfile` in triage directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t homeprohub-triage .
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  homeprohub-triage
```

### Environment Variables

Production `.env`:

```env
PORT=3001
NODE_ENV=production

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Redis for caching
REDIS_URL=redis://your-redis-host:6379

# Logging
LOG_LEVEL=warn
```

### Process Manager (PM2)

```bash
npm install -g pm2

# Start service
pm2 start dist/server.js --name homeprohub-triage

# Start on boot
pm2 startup
pm2 save
```

## Monitoring

### Health Checks

```bash
# Add to your monitoring system
curl http://localhost:3001/health
```

### Metrics to Track

- Request latency (p50, p95, p99)
- Router retry rate
- Contract validation failures
- Token usage per request
- Error rate by provider

### Example Datadog Integration

```javascript
const StatsD = require('hot-shots');
const dogstatsd = new StatsD();

// In your triage endpoint
dogstatsd.histogram('triage.latency', totalLatency);
dogstatsd.increment('triage.requests', 1, [`provider:${provider}`]);
dogstatsd.gauge('triage.router_retries', routerRetries);
```

## Cost Optimization

### Use Cheaper Models for Router

```env
OPENAI_ROUTER_MODEL=gpt-4o-mini
ANTHROPIC_ROUTER_MODEL=claude-3-haiku-20240307
```

### Cache Responses

The triage service includes caching. Enable Redis:

```env
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
```

Cache keys based on message hash for duplicate questions.

### Rate Limiting

Protect against abuse:

```javascript
import rateLimit from 'express-rate-limit';

const triageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
});

app.use('/api/ai/triage', triageLimiter);
```

## Testing Integration

### Test Request

```bash
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My basement floods when it rains heavily",
    "context": {
      "location": "Omaha, NE",
      "yearBuilt": 1975,
      "propertyType": "single_family",
      "diyLevel": "low"
    },
    "provider": "openai",
    "mode": "homeowner"
  }'
```

### Expected Response Structure

```json
{
  "request_id": "...",
  "router": {
    "domain": "foundation",
    "decision_type": "diagnose",
    "risk_level": "high",
    "posture": ["triager", "risk_manager"]
  },
  "answer_markdown": "## Immediate Actions\n...",
  "metadata": {
    "total_latency_ms": 2341
  }
}
```

## Troubleshooting

### Issue: Router validation failures

**Solution**: Check logs for Zod validation errors. The system automatically falls back to safe defaults.

### Issue: Slow response times

**Solution**:
- Use faster models for router (gpt-4o-mini, claude-haiku)
- Enable Redis caching
- Check network latency to LLM APIs

### Issue: High token costs

**Solution**:
- Use cheaper router models
- Reduce max_tokens in answer prompts
- Cache frequently asked questions

## Support

For integration questions, contact the HomeProHub engineering team.
