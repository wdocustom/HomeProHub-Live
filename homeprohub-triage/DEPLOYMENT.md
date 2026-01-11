# Deployment Guide

## Quick Local Testing

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. **Run in development:**
```bash
npm run dev
```

4. **Run tests:**
```bash
npm test
```

5. **Test endpoint:**
```bash
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Circuit breaker keeps tripping",
    "provider": "openai"
  }'
```

## Production Deployment Options

### Option 1: Docker Container

**Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**Build and run:**
```bash
docker build -t homeprohub-triage:latest .
docker run -d \
  -p 3001:3001 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e NODE_ENV=production \
  --name triage-service \
  homeprohub-triage:latest
```

### Option 2: PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Build
npm run build

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'homeprohub-triage',
    script: 'dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save configuration
pm2 save

# Set up startup script
pm2 startup
```

### Option 3: Systemd Service

```bash
# Create service file
sudo cat > /etc/systemd/system/homeprohub-triage.service << 'EOF'
[Unit]
Description=HomeProHub Triage Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/homeprohub-triage
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/opt/homeprohub-triage/.env

[Install]
WantedBy=multi-user.target
EOF

# Deploy code
sudo mkdir -p /opt/homeprohub-triage
sudo cp -r . /opt/homeprohub-triage/
cd /opt/homeprohub-triage
sudo npm ci --only=production
sudo npm run build

# Start service
sudo systemctl daemon-reload
sudo systemctl enable homeprohub-triage
sudo systemctl start homeprohub-triage
sudo systemctl status homeprohub-triage
```

## Cloud Platform Deployments

### AWS (Elastic Beanstalk)

1. **Create `.ebextensions/nodecommand.config`:**
```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
```

2. **Deploy:**
```bash
eb init
eb create homeprohub-triage-prod
eb deploy
```

3. **Set environment variables:**
```bash
eb setenv OPENAI_API_KEY=sk-...
eb setenv ANTHROPIC_API_KEY=sk-ant-...
```

### Google Cloud (Cloud Run)

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/homeprohub-triage

# Deploy
gcloud run deploy homeprohub-triage \
  --image gcr.io/PROJECT_ID/homeprohub-triage \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=sk-...,ANTHROPIC_API_KEY=sk-ant-...
```

### Heroku

```bash
# Create app
heroku create homeprohub-triage

# Set environment variables
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set ANTHROPIC_API_KEY=sk-ant-...
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Vercel (Serverless)

Create `api/triage.ts`:
```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { app } from '../src/server';

export default async (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
```

Deploy:
```bash
vercel
```

## Nginx Reverse Proxy

```nginx
upstream triage_backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name triage.homeprohub.today;

    location / {
        proxy_pass http://triage_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Load Balancing

### HAProxy Configuration

```haproxy
frontend triage_frontend
    bind *:80
    default_backend triage_backend

backend triage_backend
    balance roundrobin
    server triage1 127.0.0.1:3001 check
    server triage2 127.0.0.1:3002 check
    server triage3 127.0.0.1:3003 check
```

### Kubernetes Deployment

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homeprohub-triage
spec:
  replicas: 3
  selector:
    matchLabels:
      app: homeprohub-triage
  template:
    metadata:
      labels:
        app: homeprohub-triage
    spec:
      containers:
      - name: triage
        image: homeprohub-triage:latest
        ports:
        - containerPort: 3001
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: triage-secrets
              key: openai-key
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: triage-secrets
              key: anthropic-key
---
apiVersion: v1
kind: Service
metadata:
  name: triage-service
spec:
  selector:
    app: homeprohub-triage
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

## Redis Setup (Production)

### Docker Compose with Redis

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  triage:
    build: .
    ports:
      - "3001:3001"
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

Run:
```bash
docker-compose up -d
```

### Managed Redis (AWS ElastiCache)

```bash
# Update .env
REDIS_URL=redis://your-elasticache-endpoint.cache.amazonaws.com:6379
```

## Monitoring & Logging

### CloudWatch (AWS)

```javascript
// Install Winston CloudWatch transport
npm install winston-cloudwatch

// In logger.ts
import CloudWatchTransport from 'winston-cloudwatch';

logger.add(new CloudWatchTransport({
  logGroupName: 'homeprohub-triage',
  logStreamName: process.env.HOSTNAME,
  awsRegion: 'us-east-1'
}));
```

### Datadog

```javascript
// Install Datadog APM
npm install dd-trace

// At the top of server.ts
import tracer from 'dd-trace';
tracer.init();
```

### Sentry Error Tracking

```bash
npm install @sentry/node

# In server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.errorHandler());
```

## Security Hardening

### Environment Variables

Never commit `.env` files. Use secret management:

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name homeprohub-triage-keys \
  --secret-string '{"OPENAI_API_KEY":"sk-...","ANTHROPIC_API_KEY":"sk-ant-..."}'
```

**Fetch at runtime:**
```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function loadSecrets() {
  const data = await secretsManager.getSecretValue({
    SecretId: 'homeprohub-triage-keys'
  }).promise();
  const secrets = JSON.parse(data.SecretString);
  process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
  process.env.ANTHROPIC_API_KEY = secrets.ANTHROPIC_API_KEY;
}
```

### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
});

app.use('/api/triage', limiter);
```

### Request Size Limits

```javascript
app.use(express.json({ limit: '1mb' }));
```

## Health Checks & Uptime

### Simple HTTP Check

```bash
# Add to cron
*/5 * * * * curl -f http://localhost:3001/health || systemctl restart homeprohub-triage
```

### Advanced Health Check

Add to `server.ts`:
```javascript
app.get('/health/detailed', async (req, res) => {
  const checks = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    providers: {
      openai: await checkOpenAI(),
      anthropic: await checkAnthropic(),
    },
    cache: await checkRedis(),
  };

  const healthy = checks.providers.openai || checks.providers.anthropic;

  res.status(healthy ? 200 : 503).json(checks);
});
```

## Backup & Disaster Recovery

### Code Backup

```bash
# Automated Git backup
0 2 * * * cd /opt/homeprohub-triage && git pull && git push backup main
```

### Configuration Backup

```bash
# Backup .env and configs
0 2 * * * tar czf /backup/triage-config-$(date +\%Y\%m\%d).tar.gz \
  /opt/homeprohub-triage/.env \
  /opt/homeprohub-triage/ecosystem.config.js
```

## Cost Optimization

### Model Selection

```env
# Use cheapest models for router
OPENAI_ROUTER_MODEL=gpt-4o-mini
ANTHROPIC_ROUTER_MODEL=claude-3-haiku-20240307

# Use powerful models for answer
OPENAI_ANSWER_MODEL=gpt-4o
ANTHROPIC_ANSWER_MODEL=claude-3-5-sonnet-20241022
```

### Caching Strategy

```javascript
// Cache identical questions for 1 hour
const cacheKey = `triage:${crypto.createHash('md5').update(message).digest('hex')}`;
const cached = await cache.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... generate response ...

await cache.set(cacheKey, JSON.stringify(response), 3600);
```

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" node dist/server.js

# Enable production mode
NODE_ENV=production node dist/server.js
```

### Connection Pooling

```javascript
// For HTTP requests to LLM APIs
const https = require('https');
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
});
```

## Troubleshooting

### Check Logs

```bash
# PM2 logs
pm2 logs homeprohub-triage

# Docker logs
docker logs triage-service

# Systemd logs
journalctl -u homeprohub-triage -f
```

### Debug Mode

```bash
LOG_LEVEL=debug npm start
```

### Test Providers

```bash
# Test OpenAI connection
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{"message":"test","provider":"openai"}'

# Test Anthropic connection
curl -X POST http://localhost:3001/api/triage \
  -H "Content-Type: application/json" \
  -d '{"message":"test","provider":"anthropic"}'
```

## Rollback Plan

```bash
# Tag current version
git tag -a v1.0.0 -m "Production release"

# Rollback to previous version
git checkout v0.9.0
npm ci
npm run build
pm2 restart homeprohub-triage
```

## Support

For deployment issues, contact DevOps team or consult the main README.md.
