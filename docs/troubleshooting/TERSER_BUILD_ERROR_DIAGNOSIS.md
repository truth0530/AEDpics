# Terser Build Error Diagnosis & Solutions

**Issue**: `Unexpected early exit … (terser) renderChunk` during `npm run build`

**Status**: Environment-specific (reproduces on user's machine, not in all environments)

**Last Updated**: 2025-11-14

---

## Symptom

```
Unexpected early exit … (terser) renderChunk
Build failed! Rolling back...
```

Build fails during the Terser minification step of Next.js production build, specifically when processing the custom service worker.

---

## Known Information

| Aspect | Status |
|--------|--------|
| **Reproduces Locally (Claude)** | ❌ No - build succeeds (exit code 0) |
| **Reproduces on User Machine** | ✅ Yes - Terser error reported |
| **Affects** | next-pwa service worker bundling |
| **Worker Code** | `worker/index.js` (clean, no obvious Terser issues) |
| **PWA Config** | `next.config.ts` (standard, matches Next.js docs) |

---

## Root Cause Analysis

### Likely Causes (Priority Order)

1. **Cache Corruption** (Most Likely)
   - `.next/cache` contains corrupted build artifacts
   - `node_modules/.cache` has stale data
   - Previous failed builds left partial artifacts

2. **Node.js Version Incompatibility**
   - Terser behaves differently across Node versions
   - User's Node version may have a known issue with Terser

3. **Service Worker Code Issue** (Less Likely)
   - Specific JavaScript construct in `worker/index.js` crashes Terser
   - Only manifests on certain Node.js/Terser versions

4. **Disk Space Issue**
   - Build process runs out of disk space mid-Terser
   - Partial files written cause Terser to crash

5. **pwa Plugin Version** (Possible)
   - `@ducanh2912/next-pwa` version may have known issues
   - Next.js compatibility mismatch

---

## Diagnostic Checklist

Run these steps **in order** to identify the issue:

### Step 1: Verify Node.js & npm Versions
```bash
# Check versions
node --version  # Should be v18.0.0 or later (preferably v20.x)
npm --version   # Should be v9.0.0 or later

# If versions are old, upgrade:
nvm install 20
nvm use 20
```

**Expected**: Node.js v20.x, npm v10.x

### Step 2: Clean Build Cache
```bash
# Remove all caches
rm -rf .next
rm -rf .next.backup
rm -rf node_modules/.cache
npm cache clean --force

# Reinstall dependencies
npm install

# Try build
npm run build
```

**Expected**: Build succeeds or shows different error

### Step 3: Check Disk Space
```bash
# Check available disk space
df -h /

# Check project directory size
du -sh /path/to/AEDpics
```

**Expected**: At least 5GB free space

### Step 4: Disable Console Removal (Temporary)
```bash
# Edit next.config.ts
# Change: removeConsole: process.env.NODE_ENV === 'production' ? { exclude: [...] } : false
# To:     removeConsole: false

# Rebuild
npm run build
```

**Why**: `removeConsole` in Terser can sometimes cause issues. If build succeeds with this disabled, the problem is console removal related.

### Step 5: Build with Increased Memory
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Why**: Low memory can cause Terser to crash. 4GB should be sufficient for this project.

### Step 6: Check Service Worker Code
```bash
# Verify worker/index.js has no syntax errors
node --check worker/index.js

# Try minifying manually
npm install -D terser
npx terser worker/index.js -o worker/index.min.js -c -m
```

**Expected**: No errors from Terser

---

## Solutions by Diagnosis

### If Step 2 (Clean Cache) Fixed It
**Problem**: Cache corruption
**Solution**:
```bash
# Add to .gitignore if not already present
echo ".next" >> .gitignore
echo ".next.backup" >> .gitignore
echo "node_modules/.cache" >> .gitignore

# Do regular cache cleanup
npm cache clean --force
rm -rf .next node_modules/.cache
npm install
npm run build
```

### If Step 4 (Disable Console Removal) Fixed It
**Problem**: Terser's removeConsole option incompatible with service worker code
**Solution** (Option A - Permanent):
```typescript
// next.config.ts
compiler: {
  removeConsole: false,  // Disable entirely
}
```

**Solution** (Option B - Selective):
```typescript
// next.config.ts
compiler: {
  removeConsole: process.env.NODE_ENV === 'production' ? {
    exclude: ['error', 'warn'],
  } : false,
}

// But manually run minification:
// Add to package.json scripts:
"build:prod": "NODE_ENV=production next build"
```

### If Step 5 (More Memory) Fixed It
**Problem**: Insufficient memory for Terser
**Solution**:
```bash
# Add to CI/CD environment or machine
# For local development:
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# For CI/CD (GitHub Actions):
# Add to workflow YAML:
env:
  NODE_OPTIONS: --max-old-space-size=4096
```

### If No Step Helped
**Problem**: Likely a Terser/Next.js compatibility issue
**Solutions** (Try in Order):

1. **Update next-pwa**:
   ```bash
   npm install --save @ducanh2912/next-pwa@latest
   npm run build
   ```

2. **Update Next.js**:
   ```bash
   npm install --save next@latest
   npm run build
   ```

3. **Switch to simpler PWA setup** (Temporary):
   ```typescript
   // next.config.ts
   // Comment out PWA during investigation
   // export default nextConfig;  // No PWA wrapper
   ```

4. **Report to next-pwa** if issue persists:
   - https://github.com/ducanh2912/next-pwa/issues
   - Include: Node version, npm version, full error log

---

## Workarounds (Temporary)

### Workaround 1: Disable PWA for Build
```bash
# Temporarily disable PWA
PWA_DISABLED=true npm run build
```

Requires modification to next.config.ts:
```typescript
const withPWA = process.env.PWA_DISABLED ? (x) => x : withPWAInit({...})
```

### Workaround 2: Skip Terser (Not Recommended)
```typescript
// next.config.ts - ONLY FOR DEBUGGING
const nextConfig: NextConfig = {
  // ... other config ...
  webpack: (config, options) => {
    if (!options.isServer && options.dev === false) {
      config.optimization = {
        ...config.optimization,
        minimize: false,  // Skip minification
      }
    }
    return config
  }
}
```

**Warning**: This produces larger bundles. Only use for temporary debugging.

---

## Prevention Strategies

### 1. CI/CD Integration
Add this to GitHub Actions workflow:
```yaml
- name: Clean build cache before build
  run: |
    rm -rf .next
    rm -rf .next.backup
    npm cache clean --force

- name: Build with memory limit
  run: npm run build
  env:
    NODE_OPTIONS: --max-old-space-size=4096
```

### 2. Local Development
Create `.env.local`:
```bash
NODE_OPTIONS=--max-old-space-size=4096
```

### 3. Pre-Build Checks
Add script to `package.json`:
```json
{
  "scripts": {
    "prebuild": "rm -rf .next .next.backup node_modules/.cache",
    "build": "next build"
  }
}
```

---

## Environment Variables for Debugging

```bash
# Increase Terser verbosity (if supported)
DEBUG=next-pwa npm run build

# Skip PWA plugin entirely (for comparison)
NEXT_PUBLIC_DISABLE_PWA=true npm run build

# More memory for Node
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

---

## Test Case: Reproduce Locally

If you want to investigate further on your machine:

```bash
# 1. Start fresh
rm -rf .next node_modules
npm install

# 2. Try build with full output
npm run build 2>&1 | tee build-output.log

# 3. If it fails, examine the error
grep -A 10 "terser" build-output.log

# 4. Try with reduced complexity (disable PWA)
# Edit next.config.ts, comment out: export default withPWA(nextConfig)
# Instead use:                        export default nextConfig
npm run build

# 5. If that succeeds, PWA is the culprit
# Re-enable PWA and try solutions above
```

---

## Current Recommendations

### For Production Deployment
1. ✅ Use the cleanup commands from Step 2 before deployment
2. ✅ Ensure Node.js v20.x is installed
3. ✅ Set `NODE_OPTIONS="--max-old-space-size=4096"`
4. ⏳ Monitor for this error in CI/CD logs

### For Local Development
1. ✅ Run `npm cache clean --force` regularly
2. ✅ Delete `.next` folder before building after major changes
3. ✅ Update to latest Next.js and next-pwa versions
4. ⏳ Report exact error if it reproduces

---

## Support Resources

- **Next.js PWA**: https://nextjs.org/docs/app/building-your-application/optimizing/pwa
- **next-pwa Issues**: https://github.com/ducanh2912/next-pwa/issues
- **Terser Options**: https://github.com/terser/terser#compress-options

---

## Escalation Path

If the error persists after all solutions:

1. Collect diagnostic information:
   ```bash
   node --version > diagnostics.txt
   npm --version >> diagnostics.txt
   npm ls next @ducanh2912/next-pwa terser >> diagnostics.txt
   npm run build 2>&1 | tail -100 >> build-error.log
   ```

2. Report to:
   - next-pwa repository (with diagnostics files)
   - Next.js discussions (if PWA agnostic)
   - Your development team for immediate workaround

3. Temporary fix: Use workaround #1 (Disable PWA) until resolved

---

**Document Status**: Draft - Needs feedback from user experiencing the issue
**Next Steps**: Execute diagnostic steps and report findings
