# Installing Dependencies

This guide explains how to install the Node.js dependencies (npm packages) for HomeProHub.

## What Are Dependencies?

Dependencies are external code libraries that the project needs to run. They're listed in `package.json` and need to be downloaded and installed before you can run the server or notification worker.

---

## How to Install

### Step 1: Make Sure Node.js is Installed

First, check if Node.js is installed:

```bash
node --version
```

If you see a version number (e.g., `v18.17.0` or higher), you're good to go!

If not, download and install Node.js from:
**https://nodejs.org/** (get the LTS version)

---

### Step 2: Navigate to Project Directory

Open your terminal/command prompt and go to the HomeProHub project folder:

```bash
cd /path/to/HomeProHub-Live
```

Or if you're already in the right folder, you should see `package.json` when you run:
```bash
ls package.json
```

---

### Step 3: Run npm install

This is the command that installs all dependencies:

```bash
npm install
```

**What this does:**
- Reads `package.json` to see what packages are needed
- Downloads all packages from the npm registry
- Installs them in a folder called `node_modules/`
- Creates or updates `package-lock.json` (tracks exact versions)

**What you'll see:**
```
added 245 packages, and audited 246 packages in 15s

48 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**How long it takes:** Usually 30-60 seconds depending on your internet speed.

---

### Step 4: Verify Installation

Check if the packages were installed:

```bash
ls node_modules
```

You should see a bunch of folders (one for each package).

Or check if a specific package is there:
```bash
ls node_modules/@getbrevo
ls node_modules/stripe
ls node_modules/twilio
```

---

## What Gets Installed?

Here are the key packages that will be installed:

| Package | Purpose |
|---------|---------|
| `@getbrevo/brevo` | Email notifications via Brevo |
| `stripe` | Payment processing (subscriptions & pay-per-bid) |
| `twilio` | SMS notifications |
| `@supabase/supabase-js` | Database and authentication |
| `express` | Web server framework |
| `dotenv` | Environment variable management |

**Plus** all their dependencies (other packages they need to work).

---

## Common Issues

### Issue: "npm: command not found"

**Solution:** Node.js isn't installed or not in your PATH.
- Download from https://nodejs.org/
- Restart your terminal after installing

---

### Issue: "EACCES: permission denied"

**Solution:** You don't have permission to install globally.

Try one of these:
```bash
# Option 1: Use sudo (macOS/Linux only)
sudo npm install

# Option 2: Fix npm permissions (recommended)
# See: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

---

### Issue: "network timeout" or "ENOTFOUND"

**Solution:** Network/firewall issue.
- Check your internet connection
- Try again (npm servers might be down temporarily)
- If behind corporate firewall, talk to IT about npm registry access

---

### Issue: Package versions conflict

**Solution:** Delete node_modules and reinstall fresh:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## After Installation

Once dependencies are installed, you can:

### Run the main server:
```bash
npm start
```

### Run the notification worker:
```bash
npm run worker
```

### Run in development mode:
```bash
npm run dev
```

---

## Updating Dependencies

If `package.json` changes (new packages added), run:

```bash
npm install
```

It will automatically install any new packages.

To update all packages to their latest versions:
```bash
npm update
```

---

## Where Are Dependencies Stored?

- **node_modules/** - All installed packages (NOT committed to git)
- **package.json** - List of dependencies and versions
- **package-lock.json** - Exact versions that were installed (committed to git)

**Important:** Never commit `node_modules/` to git! It's huge and gets recreated with `npm install`.

---

## Production Deployment

When deploying to a server:

```bash
# Install only production dependencies (no dev tools)
npm install --production

# Or use npm ci for faster, cleaner installs
npm ci --production
```

---

## Need Help?

- **npm documentation**: https://docs.npmjs.com/
- **Node.js documentation**: https://nodejs.org/docs/
- **Check package.json**: See exact list of what's being installed

---

## Quick Reference

| Command | What It Does |
|---------|--------------|
| `npm install` | Install all dependencies |
| `npm install --production` | Install only production dependencies |
| `npm update` | Update all packages to latest versions |
| `npm outdated` | Check which packages have updates available |
| `npm list` | Show all installed packages |
| `npm list <package-name>` | Check if specific package is installed |
