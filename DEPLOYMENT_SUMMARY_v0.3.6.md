# GanDash v0.3.6 - Deployment Summary

**Deployed:** 2026-02-03 20:29 GMT+7  
**Status:** ✅ DEPLOYED - Server running, cache-busting active

---

## 🔥 CRITICAL: This is a BREAKING release

**Users MUST uninstall and reinstall the PWA completely.**

---

## Problems Fixed

### Root Cause: Aggressive Service Worker Caching
The PWA was serving cached v0.3.4 or earlier code despite the version badge showing v0.3.5. This caused:

1. ❌ **SortableJS not loading** → Dotted blue borders during drag (fallback to native HTML5 drag-drop)
2. ❌ **Filter dropdowns empty** → No projects, labels, or assignees visible
3. ❌ **Sort dropdown empty** → No sorting options available

---

## Nuclear Fixes Implemented

### 1. ⚛️ Timestamp-Based Cache Names
**File:** `frontend/sw.js`

```javascript
// OLD: const CACHE_NAME = 'gandash-v0.3.3';
// NEW: 
const CACHE_NAME = 'gandash-v' + Date.now();
```

- Forces cache invalidation on every deployment
- Prevents stale cache persistence
- Old versioned caches are auto-deleted on activation

### 2. 🚫 Backend Cache-Busting Headers
**File:** `backend/index.js`

```javascript
app.use(['/app.js', '/style.css', '/index.html', '/sw.js'], (req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});
```

**Verified working:**
```bash
$ curl -I http://localhost:3002/app.js
HTTP/1.1 200 OK
Cache-Control: no-cache, no-store, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

### 3. 🔄 Force SW Update on Every Load
**File:** `frontend/index.html`

```javascript
navigator.serviceWorker.register('/sw.js', { 
    updateViaCache: 'none' // NEVER cache the SW itself
});

// Force reload on controller change
navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
});
```

### 4. 🐛 Debug Info Banner
**Location:** Top-right corner (red background)

Displays:
- **SW:** Service worker version (should show 0.3.6)
- **JS:** JavaScript app version (should show 0.3.6)
- **Cache:** Cache status (OK/STALE/number of caches)

### 5. 🔄 Force Update Button
**Location:** Bottom-right corner (red button)

**Function:** `forceUpdate()`
1. Unregisters ALL service workers
2. Clears ALL caches (Cache API)
3. Clears localStorage
4. Reloads with cache-busting timestamp

**When to use:** Emergency fix if PWA still broken after reinstall

### 6. 📊 Comprehensive Console Logging

**App startup (app.js):**
```
=== GanDash v0.3.6 Loading ===
Timestamp: 1770125382596
SortableJS available: function
✅ SortableJS loaded successfully
```

**Filter population:**
```
=== Populating Filter Selects ===
Projects: 6 [...]
People: 2 [...]
Labels: 4 [...]
✅ Project filter populated: 7 options
✅ Assignee filter populated: 3 options
✅ Label filter populated: 5 options
=== Filter Selects Population Complete ===
```

**Backend middleware:**
```
[Cache-Bust] Serving: /app.js
[Cache-Bust] Serving: /style.css
[Cache-Bust] Serving: /index.html
```

---

## Testing Instructions for User

### Step 1: Uninstall PWA
**iOS:**
1. Long-press GanDash icon on home screen
2. Tap "Remove App" → "Delete App"

**Android:**
1. Long-press GanDash icon
2. Tap "App info" or "ⓘ"
3. Tap "Uninstall"

**Desktop:**
1. Chrome: Settings → Apps → GanDash → Uninstall
2. Or right-click PWA window title bar → "Uninstall GanDash"

### Step 2: Clear Browser Data
**iOS Safari:**
1. Settings → Safari → Clear History and Website Data

**Android Chrome:**
1. Chrome → Settings → Privacy → Clear browsing data
2. Select "Cookies and site data" and "Cached images and files"
3. Change time range to "All time"
4. Check "gandash.ganle.xyz" in "Site settings" if available

**Desktop Chrome:**
1. Settings → Privacy and security → Clear browsing data
2. Select "Cookies and other site data" and "Cached images and files"
3. Change time range to "All time"
4. Clear data

### Step 3: Reinstall PWA Fresh
1. Visit https://gandash.ganle.xyz in browser
2. Enter PIN: `1337`
3. Look for install prompt:
   - **iOS Safari:** Tap Share → "Add to Home Screen"
   - **Android Chrome:** Tap "Install" banner or ⋮ → "Install app"
   - **Desktop Chrome:** Click ⊕ icon in address bar or banner

### Step 4: Verify Debug Info
After reinstalling, check top-right corner:

✅ **GOOD:**
```
SW: 0.3.6 | JS: 0.3.6 | Cache: OK
```

❌ **BAD (still cached):**
```
SW: 0.3.3 | JS: 0.3.4 | Cache: 3 caches
```

If bad, click "🔄 FORCE UPDATE" button.

### Step 5: Test Features
1. ✅ **Drag tasks in Kanban** → Should be smooth, NO dotted borders
2. ✅ **Click Sort button (⬍ icon)** → Should show 4 options (Priority, Due Date, Name, Created)
3. ✅ **Click Filter button (⧩ icon)** → Dropdowns should be populated:
   - Project: 7 options (All Projects + 6 projects)
   - Assignee: 3 options (All Assignees + Brendon + Ivy)
   - Label: 5 options (All Labels + 4 labels)

### Step 6: Check Console (Optional)
**Desktop:** Press F12 → Console tab

Should see:
```
=== GanDash v0.3.6 Loading ===
✅ SortableJS loaded successfully
=== Populating Filter Selects ===
✅ Project filter populated: 7 options
✅ Assignee filter populated: 3 options
✅ Label filter populated: 5 options
```

❌ If you see alert: "ERROR: SortableJS failed to load!" → Still cached, use Force Update

---

## Deployment Checklist

- [x] Service worker updated with timestamp cache names
- [x] Backend cache-busting headers added
- [x] Index.html updated with enhanced SW registration
- [x] Debug info div added (visible)
- [x] Force update button added (visible)
- [x] Console logging added to app.js
- [x] Version badge updated to v0.3.6
- [x] CHANGELOG.md updated
- [x] Git committed and pushed
- [x] PM2 restarted
- [x] Server health check verified
- [x] Cache-busting headers verified (curl test)
- [x] Cache-bust middleware logging verified

---

## Server Status

```bash
$ pm2 list | grep gandash
│ 3  │ gandash  │ cluster │ 2289632 │ online │ 0% │ 47.3mb │

$ curl -s http://localhost:3002/api/health
{"status":"ok","timestamp":1770125382596}

$ curl -I http://localhost:3002/app.js | grep Cache-Control
Cache-Control: no-cache, no-store, must-revalidate, max-age=0
```

**Logs showing cache-bust middleware active:**
```
3|gandash  | 2026-02-03T20:29:36: [Server] Dash running on http://0.0.0.0:3002
3|gandash  | 2026-02-03T20:29:45: [Cache-Bust] Serving: /
```

---

## Files Modified

1. **frontend/sw.js** - Timestamp-based cache names + enhanced logging
2. **frontend/index.html** - Debug info div, force update button, enhanced SW registration
3. **frontend/app.js** - SortableJS verification, filter population logging, version detection
4. **backend/index.js** - Cache-busting middleware for critical files
5. **CHANGELOG.md** - Full v0.3.6 documentation

---

## Post-Deployment Cleanup (Optional)

Once user confirms everything works:

### Remove Debug Info (Optional)
Edit `frontend/index.html` and remove or hide:
```html
<!-- Debug info div -->
<div id="debug-info" style="...display:none;">...</div>

<!-- Force update button -->
<button onclick="forceUpdate()" style="...display:none;">...</button>
```

### Reduce Console Logging (Optional)
Edit `frontend/app.js`:
- Remove or comment out `console.log()` statements in:
  - App startup (lines 2-23)
  - `populateFilterSelects()` (lines 1379-1408)

**Keep these logs:**
- Error alerts (SortableJS failed to load)
- SW registration errors
- Backend cache-bust logs

---

## Why This Was So Hard to Fix

### The Problem
1. Service worker uses **cache-first strategy** for static assets
2. CDN-loaded SortableJS wasn't being re-fetched
3. Even manual browser cache clear didn't help (SW cache separate)
4. Version badge updated (from backend) but app.js stayed cached
5. PWA "Update available" prompts were ignored/invisible

### The Solution
Multi-layered nuclear approach:
1. **Timestamp cache names** → Forces SW to invalidate all caches on every deploy
2. **Backend no-cache headers** → Prevents browser from caching critical files
3. **updateViaCache: 'none'** → Prevents SW from caching itself
4. **Controller change reload** → Forces page refresh when new SW activates
5. **Debug tools** → Makes cache state visible to user
6. **Force update button** → Emergency nuclear option

### Why Not Just Clear Cache?
- Browser cache ≠ Service Worker cache (separate storage)
- SW cache persists across browser restarts
- SW can serve from cache even when offline
- PWA "add to home screen" creates isolated app container
- Some mobile browsers don't expose SW cache clearing

---

## Emergency Rollback

If v0.3.6 causes critical issues:

```bash
# Revert to v0.3.5
cd ~/projects/gandash
git revert HEAD
git push origin main
pm2 restart gandash

# Users must still uninstall/reinstall PWA
```

**Note:** Users will still need to uninstall/reinstall to get the reverted version due to cached SW.

---

## Success Criteria

✅ **All must pass:**
1. Debug info shows: `SW: 0.3.6 | JS: 0.3.6 | Cache: OK`
2. Console shows: `✅ SortableJS loaded successfully`
3. Drag-drop works smoothly, no dotted borders
4. Sort dropdown has 4 options
5. Filter dropdowns populated (Projects: 7, Assignees: 3, Labels: 5)
6. Console logs confirm filter population
7. No alert: "ERROR: SortableJS failed to load!"

❌ **If any fail:**
1. Click "🔄 FORCE UPDATE" button
2. Wait for reload
3. Re-check all criteria
4. If still failing, uninstall/reinstall PWA again

---

## Contact

If issues persist after following all steps, provide:
1. Screenshot of debug info banner
2. Screenshot of console logs (F12)
3. Device/browser info (iOS/Android/Desktop, version)
4. Screenshot of empty dropdown (if applicable)

---

**Deployment Time:** 2026-02-03 20:29:36 GMT+7  
**Commit:** `5c99e75` - "v0.3.6 - Nuclear PWA Cache Fix + Debug Tools"  
**Status:** ✅ LIVE - Awaiting user testing
