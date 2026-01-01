# HomeProHub Triage

Production-ready LLM orchestration layer for home improvement triage.

## Architecture

Two-pass LLM system:

1. **Router Pass (Cheap Model)**: Classifies user message into structured JSON with domain, decision type, risk level, posture, and metadata.
2. **Answer Pass (Strong Model)**: Generates comprehensive, decisive triage answer following strict response contract.

### Key Features

- **Deterministic Structure**: Zod schema validation with automatic retry and fallback
- **Risk-Based Posture Routing**: High risk → triager + risk_manager, Medium → explainer + risk_manager, Low → explainer
- **Multi-Provider Support**: OpenAI and Anthropic with common interface
- **Response Contract Enforcement**: 7 required sections in strict order
- **Comprehensive Logging**: Request ID tracking, latency metrics, token usage
- **Caching**: In-memory cache with optional Redis adapter

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key and/or Anthropic API key

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API keys:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

3. (Optional) Configure models:
```env
OPENAI_ROUTER_MODEL=gpt-4o-mini
OPENAI_ANSWER_MODEL=gpt-4o
ANTHROPIC_ROUTER_MODEL=claude-3-haiku-20240307
ANTHROPIC_ANSWER_MODEL=claude-3-5-sonnet-20241022
```

### Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3001`

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

## API Reference

### POST /api/triage

Main triage endpoint.

**Request:**
```json
{
  "message": "My circuit breaker keeps tripping when I run the microwave",
  "context": {
    "location": "Omaha, NE",
    "yearBuilt": 1985,
    "propertyType": "single_family",
    "diyLevel": "medium",
    "budgetBand": "medium"
  },
  "provider": "openai",
  "mode": "homeowner"
}
```

**Request Fields:**
- `message` (required): User's question/description
- `context` (optional): User context object
  - `location`: City, State
  - `yearBuilt`: Property year built
  - `propertyType`: `single_family | condo | townhouse | multi_family | commercial`
  - `diyLevel`: `none | low | medium | high | expert`
  - `budgetBand`: `low | medium | high | unknown`
- `provider` (optional): `openai | anthropic` (default: `openai`)
- `mode` (optional): `homeowner | contractor` (default: `homeowner`)

**Response:**
```json
{
  "request_id": "a1b2c3d4-...",
  "router": {
    "domain": "electrical",
    "decision_type": "diagnose",
    "risk_level": "high",
    "posture": ["triager", "risk_manager"],
    "assumptions": ["Circuit is overloaded"],
    "must_include": ["Safety warnings", "Professional inspection"],
    "clarifying_questions": ["How often does it trip?"],
    "tooling": {
      "needs_local_resources": true,
      "needs_citations": false
    }
  },
  "answer_markdown": "## Immediate Actions\n...",
  "metadata": {
    "router_latency_ms": 234,
    "answer_latency_ms": 1567,
    "total_latency_ms": 1801,
    "router_retries": 0
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "config": {
    "valid": true,
    "errors": []
  }
}
```

## Sample cURL Commands

### Basic Triage (OpenAI)

```bash
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Water stain spreading on ceiling below bathroom",
    "provider": "openai"
  }'
```

### Triage with Full Context (Anthropic)

```bash
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Foundation crack widening, house settling",
    "context": {
      "location": "Denver, CO",
      "yearBuilt": 1965,
      "propertyType": "single_family",
      "diyLevel": "low",
      "budgetBand": "high"
    },
    "provider": "anthropic",
    "mode": "homeowner"
  }'
```

### Contractor Mode

```bash
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Load-bearing wall removal permit requirements",
    "context": {
      "location": "Austin, TX",
      "propertyType": "single_family"
    },
    "provider": "openai",
    "mode": "contractor"
  }'
```

### Health Check

```bash
curl http://localhost:3001/health
```

## Router Taxonomy

### Domains
`structural`, `foundation`, `roofing`, `electrical`, `plumbing`, `hvac`, `interior_finish`, `mold_env`, `pest`, `landscaping`, `general`

### Decision Types
`diagnose`, `estimate_cost`, `hire_contractor`, `DIY_steps`, `permit_code`, `product_recommendation`, `comparison`, `planning`

### Risk Levels
- **High**: Electrical fire, gas leaks, structural movement, mold/toxins, flooding
- **Medium**: Water leaks, HVAC failures, plumbing backups
- **Low**: Cosmetic, paint, decor, general maintenance

### Postures
- **explainer**: Educate user on what's happening
- **triager**: Prioritize actions by urgency
- **risk_manager**: Focus on safety and hazard mitigation
- **optimizer**: Cost/quality/time optimization

## Response Contract

All answers include these sections in order:

1. **Immediate Actions**: What to do right now (safety first)
2. **Likely Causes**: Ranked probable causes with reasoning
3. **Cost & Effort Range**: Realistic cost ranges (DIY materials + professional labor)
4. **What Changes the Price**: Factors affecting cost
5. **Hiring & Next Steps**: When/how to hire professionals, local considerations
6. **Red Flags & Don'ts**: Warning signs and common mistakes
7. **Clarifying Questions**: Max 5 questions that materially change advice

## Validation & Error Handling

### Router JSON Validation

1. First attempt: Parse router JSON
2. If validation fails: Retry with repair prompt
3. If repair fails: Fall back to safe default router output
4. Safe default: `{ domain: "general", risk_level: "medium", posture: ["explainer", "risk_manager"], ... }`

### Response Contract Validation

- Answer markdown validated for all 7 required sections
- Missing sections logged as warnings
- Validation warning appended to response if sections missing

## Project Structure

```
src/
├── server.ts              # Express server & endpoints
├── config.ts              # Configuration & validation
├── types.ts               # TypeScript interfaces
├── cache.ts               # In-memory & Redis cache
├── logger.ts              # Structured logging (Winston)
├── providers/
│   ├── index.ts           # Provider factory
│   ├── base.ts            # Base provider class
│   ├── openai.ts          # OpenAI implementation
│   └── anthropic.ts       # Anthropic implementation
├── router/
│   ├── schema.ts          # Zod schemas & validation
│   ├── router.ts          # Router orchestration logic
│   └── taxonomies.ts      # Domain/decision/risk taxonomies
├── answer/
│   ├── answer.ts          # Answer generation logic
│   └── contract.ts        # Response contract validation
└── prompts/
    ├── router.ts          # Router system & user prompts
    ├── answer.ts          # Answer system & user prompts
    └── repair.ts          # JSON repair prompts

tests/
├── validation.test.ts     # Schema & contract validation tests
├── router.test.ts         # Risk scoring & posture tests
└── integration.test.ts    # End-to-end flow tests
```

## Logging

Structured JSON logs include:
- `request_id`: Unique request identifier
- `provider`: LLM provider used
- `model`: Model name
- `latency_ms`: Operation latency
- `tokens`: Token usage (prompt, completion, total)
- `router_output`: Classified router JSON
- `router_retries`: Number of retry attempts
- `validation`: Contract validation results
- `error`: Error messages and stack traces

## Performance

Typical latency (OpenAI gpt-4o-mini + gpt-4o):
- Router pass: ~200-400ms
- Answer pass: ~1500-2500ms
- Total: ~2000-3000ms

Typical token usage:
- Router: ~150-300 tokens
- Answer: ~800-1500 tokens

## Production Considerations

### Caching

Set `REDIS_URL` to enable Redis caching:
```env
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
```

### Rate Limiting

Not implemented. Add rate limiting middleware for production:
```bash
npm install express-rate-limit
```

### Monitoring

Integrate with application monitoring:
- Request ID for tracing
- Latency metrics for SLOs
- Token usage for cost tracking
- Error rates for alerting

### Security

- Helmet.js enabled for HTTP headers
- CORS enabled (configure allowed origins)
- Input validation via Zod
- No sensitive data in logs

## License

MIT

## Support

For issues or questions, contact HomeProHub engineering team.
