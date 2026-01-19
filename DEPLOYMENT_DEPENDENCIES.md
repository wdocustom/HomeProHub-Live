# Deployment System Dependencies

## Required System Packages

The HomeProHub application requires certain system-level packages to be installed before `npm install` can complete successfully.

### Canvas Package (Image Processing)

The `canvas` npm package requires Cairo and Pango libraries.

**For Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev
```

**For Amazon Linux/RHEL/CentOS:**
```bash
sudo yum groupinstall -y "Development Tools"
sudo yum install -y \
  cairo-devel \
  pango-devel \
  libjpeg-turbo-devel \
  giflib-devel
```

**For Alpine Linux (Docker):**
```bash
apk add --no-cache \
  build-base \
  cairo-dev \
  pango-dev \
  jpeg-dev \
  giflib-dev \
  librsvg-dev
```

### Why Canvas is Needed

The canvas package is used for:
- Processing uploaded blueprint images
- Generating project estimate visualizations
- Image manipulation for contractor profiles

---

## Workaround: Install Without Build Scripts

If you cannot install system dependencies (e.g., in a sandboxed environment), you can install npm packages without building native modules:

```bash
npm install --ignore-scripts
```

**Limitations:**
- Image processing features will not work
- Canvas-dependent features will throw errors at runtime
- Not recommended for production

---

## Production Deployment Checklist

Before deploying to production:

1. ✅ Install system dependencies (cairo, pango, etc.)
2. ✅ Run `npm ci` or `npm install`
3. ✅ Verify canvas installation: `node -e "require('canvas'); console.log('OK')"`
4. ✅ Run pre-deployment validation: `npm run validate:pre-deploy`
5. ✅ Set all required environment variables
6. ✅ Test server startup: `NODE_ENV=production node server.js` (Ctrl+C after start)
7. ✅ Deploy with PM2: `npm run pm2:start`

---

## Docker Deployment

If using Docker, include system dependencies in your Dockerfile:

```dockerfile
FROM node:18-alpine

# Install system dependencies for canvas
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

---

## Render.com Deployment

Render.com build system includes build-essential and common libraries.

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

Render should handle canvas dependencies automatically. If not, add a `render.yaml`:

```yaml
services:
  - type: web
    name: homeprohub
    env: node
    buildCommand: |
      apt-get update
      apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
      npm install
    startCommand: npm start
```

---

## Troubleshooting

### Error: Package 'pangocairo' not found

**Cause:** System libraries not installed.

**Solution:** Install cairo and pango dev packages (see above).

### Error: node-gyp rebuild failed

**Cause:** Build tools not installed or outdated.

**Solution:**
```bash
# Install build tools
sudo apt-get install -y build-essential

# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Canvas works locally but fails in production

**Cause:** Different OS or missing system libraries.

**Solution:**
1. Check production OS and install appropriate packages
2. Verify `/usr/lib` and `/usr/include` have cairo/pango libraries
3. Run `pkg-config --cflags --libs cairo` to test

---

## Optional: Remove Canvas Dependency

If image processing is not critical, you can make canvas optional:

**In server.js or wherever canvas is used:**
```javascript
let canvasModule;
try {
  canvasModule = require('canvas');
} catch (err) {
  console.warn('⚠️  Canvas not available - image processing disabled');
  canvasModule = null;
}

// Then use it conditionally:
if (canvasModule) {
  // Process image
} else {
  // Skip or use alternative
}
```

This allows deployment without canvas, with graceful degradation.

---

## Support

For deployment issues:
- Check system logs: `journalctl -u homeprohub`
- Check PM2 logs: `pm2 logs homeprohub`
- Check npm logs: `cat ~/.npm/_logs/*-debug-*.log`

---
