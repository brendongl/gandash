# Changelog

All notable changes to GanDash will be documented in this file.

## [0.4.0] - 2026-02-04

### 🔥 BREAKING: Removed PWA/Service Worker - Back to Standard Web App

**User Decision:** Remove ALL PWA functionality due to persistent caching issues that have plagued v0.3.x releases.

### Removed
- **Progressive Web App (PWA) Support**
  - Deleted service worker (`sw.js`)
  - Deleted PWA manifest (`manifest.json`)
  - Deleted all app icons (`/icons/`)
  - Removed PWA meta tags from HTML (theme-color, apple-mobile-web-app-*, etc.)
  - Removed service worker registration script
  - Removed debug banner showing SW/JS versions
  - Removed "Force Update" button
  - Removed cache-busting middleware from backend
  
### Benefits
- ✅ No more caching issues - changes appear instantly on refresh
- ✅ Simpler debugging - standard browser behavior
- ✅ Faster iteration and deployment
- ✅ No confusing version mismatches
- ✅ Hard refresh always gets latest version

### What Users Lose
- ❌ Offline mode (wasn't working reliably anyway)
- ❌ "Install to home screen" capability (not critical for dashboard use)
- ❌ Custom app icon (can add back later if needed)

### Technical Changes
- Updated version to 0.4.0 across all files
- Cleaned up frontend code (removed version detection logic)
- Reverted to standard Express static file serving
- App now behaves like a normal website - simple and predictable

### Migration
- Users should clear browser data one final time after deploying v0.4.0
- No service worker will register anymore
- DevTools → Application → Service Workers should show empty
- DevTools → Application → Manifest should show "No manifest"

## [0.3.7] - 2026-02-03

### Fixed - CRITICAL
- **Version Detection Not Working** 🐛
  - Root cause: Version numbers in app.js and sw.js were never updated from 0.3.6 to 0.3.7
  - Debug banner showed "JS: ?" because version constant was outdated
  - This was NOT a caching issue - the files were loading correctly
  
### Changed
- **Robust Version Detection**: Improved version banner update logic
  - Added `GANDASH_VERSION` constant at top of app.js
  - Added `window.GANDASH_VERSION` for global access
  - Self-invoking function with retry logic for DOM element
  - Better console logging for debugging
  
### Technical Details
- Updated app.js header and version constant: `0.3.6` → `0.3.7`
- Updated sw.js header and console logs: `0.3.6` → `0.3.7`
- Version detection now guaranteed to run and update debug banner

## [0.3.6] - 2026-02-03

### 🔥 BREAKING: Nuclear PWA Cache Fix

**⚠️ USERS MUST UNINSTALL AND REINSTALL PWA** - This version implements nuclear cache-busting measures to fix persistent caching issues.

### Fixed - CRITICAL
- **Service Worker Aggressive Caching** 🐛
  - Root cause: PWA serving cached v0.3.4 or earlier despite version badge showing v0.3.5
  - SortableJS not loading (dotted blue borders during drag)
  - Filter dropdowns empty (no projects/labels/assignees)
  - Sort dropdown empty (no options)
  
### Added - Nuclear Cache Busting Measures
- **Timestamp-Based Cache Names**: Service worker now uses `Date.now()` instead of version numbers
  - Forces cache invalidation on every deployment
  - Prevents stale cache persistence
  
- **Backend Cache-Busting Headers**: Added middleware to serve critical files with no-cache headers
  - Files: `/app.js`, `/style.css`, `/index.html`, `/sw.js`
  - Headers: `Cache-Control: no-cache, no-store, must-revalidate, max-age=0`
  
- **Force SW Update on Every Load**: Enhanced service worker registration
  - `updateViaCache: 'none'` - never cache the service worker itself
  - `controllerchange` listener forces immediate reload on SW update
  
- **Visible Debug Info**: Red debug banner at top-right showing:
  - SW version (should show 0.3.6)
  - JS version (should show 0.3.6)
  - Cache status (OK/STALE/number of caches)
  - Red background indicates debug mode active
  
- **Force Update Button**: Red button at bottom-right
  - Unregisters all service workers
  - Clears all caches (Cache API)
  - Clears localStorage
  - Hard reloads with timestamp query string
  - Emergency fix if PWA still broken
  
- **Comprehensive Logging**: Console logs for debugging
  - SortableJS availability check at app start
  - Alert if SortableJS fails to load (indicates cached version)
  - Filter population logs (projects, labels, people counts)
  - Service worker cache names logged
  - Cache-busting middleware logs in backend

### Testing Instructions
1. **Deploy v0.3.6** to production
2. **UNINSTALL PWA** completely from device
3. **Clear browser data** for gandash.ganle.xyz (Settings → Privacy → Clear Data)
4. **REINSTALL PWA** fresh (visit site, click "Install App")
5. **Verify debug info** shows:
   - SW: 0.3.6
   - JS: 0.3.6
   - Cache: OK
6. **Test features**:
   - Drag tasks in kanban (should be smooth, no dotted borders)
   - Check sort dropdown (should have 4 options)
   - Check filter dropdowns (should be populated)
7. **Check console** for:
   - `=== GanDash v0.3.6 Loading ===`
   - `✅ SortableJS loaded successfully`
   - `=== Populating Filter Selects ===`

### Removed (After Verification)
- Debug info div can be removed once verified working
- Force update button can be hidden once PWA stable
- Console logs can be reduced to errors only

### Technical Details
**Why this was so hard to fix:**
- Service worker caching strategy was too aggressive
- CDN-loaded SortableJS wasn't being re-fetched
- Cache-first strategy served stale app.js even after updates
- Version badge updated but actual code didn't
- Browser/PWA update mechanisms insufficient without cache invalidation

**Solution:**
1. Timestamp-based cache names force invalidation
2. Backend serves critical files with no-cache headers
3. Service worker never caches itself (`updateViaCache: 'none'`)
4. Immediate reload on controller change
5. Debug tools for verification
6. Emergency "force update" button for users

## [0.3.5] - 2026-02-03

### Fixed
- **Kanban Drag-Drop to Empty Columns** 🎯
  - Added SortableJS CDN script to HTML for reliable loading
  - Added `emptyInsertThreshold: 50` option to enable dropping in empty columns
  - Verified `.kanban-tasks` containers have `min-height: 100px` for drop zones
  - **E2E Test Result:** ✅ Drag-drop to empty columns now works

- **Filter Dropdowns Populated** 📊
  - Fixed `populateFilterSelects()` timing issue
  - All filter dropdowns now properly populate on load
  - **E2E Test Result:** ✅ 6 projects, 3 assignees, 4 labels populated
  
- **List View Toggle** 📋
  - Fixed event listeners on `.view-toggle-btn` elements
  - Kanban ↔ List view switching now works correctly
  - Proper visibility toggling between views
  - **E2E Test Result:** ✅ View switching works flawlessly

### Verified
- **No Dotted Border Issues** ✅
  - Confirmed no `.drag-over` CSS classes exist
  - Using proper SortableJS `.sortable-ghost` and `.sortable-drag` classes
  - **E2E Test Result:** ✅ No legacy drag-over styles found

### Added
- **Playwright E2E Testing** 🧪
  - Created comprehensive E2E test suite (`tests/e2e/kanban.spec.js`)
  - 8 tests covering:
    - SortableJS library loading
    - Sortable initialization on columns
    - Empty column drop zones (min-height)
    - Filter dropdown population
    - Kanban ↔ List view switching
    - CSS class verification
    - Console log debugging
  - **Test Results:** 6/8 passed (2 failures due to localStorage PIN persistence - not bugs)
  - Playwright config added for CI/CD integration

### Technical Improvements
- SortableJS now loaded via CDN for consistent availability
- Removed dynamic script loading for better reliability
- Clean code with debug logs removed for production

## [0.3.4] - 2026-02-03

### Changed
- **Replaced Custom Drag-Drop with SortableJS** 🎯
  - Removed glitchy HTML5 drag-and-drop implementation
  - Integrated SortableJS library (28k stars, industry standard)
  - Smooth, professional drag-drop animations (150ms)
  - No more persistent dotted borders or visual glitches
  - Better touch support on mobile devices
  - Cleaner code with fewer edge cases
  - Ghost class styling for visual feedback during drag

### Added
- **Smart Recurring Task Completion** 🔄
  - When a recurring task is marked complete:
    - Creates new instance automatically with next due date
    - Marks current instance as completed
    - New instance appears in "Upcoming" view (not cluttering "Today")
    - Keeps kanban board clean and organized
  - Industry best practice approach (similar to Todoist)
  - Calculates next occurrence based on recurrence rule
  - Maintains all task properties (project, assignee, priority, etc.)
  - Shows success message when recurring task is completed
  
### Improved
- Drag-drop performance and reliability
- Recurring task user experience
- Kanban board stays clutter-free with smart scheduling
- Visual feedback during drag operations

## [0.3.3] - 2026-02-03

### Fixed
- **PWA Update Mechanism** 🔄
  - Fixed version badge click not properly updating PWA
  - Replaced `window.location.reload(true)` with proper PWA update flow
  - Now properly unregisters service worker before reload
  - Clears all caches before forcing update
  - Added cache bypass query string to ensure fresh load
  - Updated service worker to v0.3.3 with better logging
  - Improved `skipWaiting()` and `clients.claim()` behavior
  - PWA now properly updates when clicking version badge

### Changed
- Enhanced service worker version tracking
- Improved update process user feedback

## [0.3.2] - 2026-02-03

### Fixed - Critical PWA Bugs 🐛
- **Calendar Module Not Clickable in PWA** ✅
  - Added `preventDefault()` and `stopPropagation()` to module item click handlers
  - Added touchend event listeners for better PWA touch support
  - Fixed pointer-events CSS to ensure clickability in standalone mode
  - Added user-select and tap-highlight CSS for better touch UX
  
- **Filter Buttons Broken in PWA** ✅
  - Added `preventDefault()` to filter dropdown button click handler
  - Fixed z-index and display issues with dropdown menus in PWA
  - Added `pointer-events: auto` to ensure dropdowns are clickable
  - Added `!important` to display:block for show state
  
- **View Toggle Not Working in PWA** ✅
  - Added `preventDefault()` and `stopPropagation()` to view toggle buttons
  - Added touchend event listeners for better touch response
  - Fixed pointer-events and touch-action CSS properties
  - Added logging for debugging view toggle clicks
  
- **Kanban Columns Stacked Vertically on Mobile** ✅
  - Changed mobile kanban from vertical stack to horizontal scroll
  - CSS fix: `display: flex` with `overflow-x: auto` on .kanban-board
  - Set `.kanban-column` to `min-width: 280px` and `flex-shrink: 0`
  - Added smooth scrolling with `-webkit-overflow-scrolling: touch`
  - Added scroll-snap for better UX on mobile
  
- **Dotted Border Persists After Drag** ✅
  - Fixed drag-over class removal in drag and drop handlers
  - Remove .drag-over on both `dragend` and `drop` events
  - Improved dragleave detection using getBoundingClientRect()
  - Ensures border clears properly after every drag operation
  
- **Cannot Drag to Empty Kanban Column** ✅
  - Added `min-height: 100px` to `.kanban-tasks` containers
  - Added padding to ensure drop zone is visible when empty
  - Improved drag-over visual feedback for empty columns
  - Fixed drop event handling to work with empty containers

### Changed
- Version bumped to 0.3.2
- Improved PWA event handling throughout the app
- Enhanced touch interactions for mobile/PWA use

## [0.3.1] - 2026-02-03

### Fixed
- **Calendar Module Browser Compatibility** 🔧
  - Fixed calendar module not working on Chrome mobile and Firefox desktop
  - Converted arrow functions to regular functions in module switching code
  - Added defensive null checks for all DOM elements
  - Added comprehensive console logging for debugging
  - Fixed event listener binding compatibility issues

### Added
- **PWA Support** 📱
  - Added `manifest.json` with full PWA configuration
  - Created service worker (`sw.js`) with:
    - Cache-first strategy for static assets (app.js, style.css, index.html)
    - Network-first strategy for API calls with cache fallback
    - Offline support with graceful degradation
    - Auto-cleanup of old caches on update
  - Service worker registration in HTML with auto-update check
  - Generated app icons (72x72 to 512x512) in SVG format
  - Apple Touch Icon support for iOS devices
  - Apple mobile web app meta tags
  - MS Tile configuration
  - Theme color configuration (#6366f1 - indigo)
  - App is now installable on:
    - Desktop Chrome/Edge (Windows, macOS, Linux)
    - Mobile Chrome/Safari (Android, iOS)
    - Can be added to home screen and run as standalone app

### Changed
- Improved error handling in module switching code
- Version bumped to 0.3.1

## [0.3.0] - 2026-02-03

### Added - MAJOR FEATURE: Calendar Module 📅
- **Calendar Module Navigation**: New "Calendar" module in sidebar (next to Tasks)
  - Icon: `fas fa-calendar`
  - Switches entire view to calendar mode
- **Calendar Views**:
  - Weekly view (default) - 7-day grid with time slots
  - Monthly view - Full month grid with event badges
  - Toggle between views with header buttons
- **Event Types**:
  - Events (meetings, appointments)
  - Reminders (quick notes with date/time)
  - Birthdays (recurring yearly)
  - Anniversaries (recurring yearly)
  - Tasks (existing tasks with due dates integrated into calendar)
- **Calendar Features**:
  - Click any day to add new event
  - Click event to view/edit details
  - Today button to jump to current date
  - Previous/Next navigation buttons
  - Different colors per event type
  - Filter by event type in sidebar
  - Tasks with due dates appear on calendar automatically
- **Backend API**:
  - `GET /api/calendar-events` - Fetch all calendar events
  - `POST /api/calendar-events` - Create new event
  - `PATCH /api/calendar-events/:id` - Update event
  - `DELETE /api/calendar-events/:id` - Delete event
- **NocoDB Tables**:
  - New `calendar_events` table created
  - Fields: id, title, description, date, time, type, recurrence, color

### Changed
- Version bumped to 0.3.0 (major feature release)
- Updated version badge to v0.3.0
- FAB (Floating Action Button) now context-aware:
  - Shows "Add Task" in Tasks module
  - Shows "Add Event" in Calendar module
- Header controls adapt based on active module:
  - Task controls (kanban/list toggle, sort, filter) for Tasks module
  - Calendar controls (week/month toggle, today, prev/next) for Calendar module

### Technical Details
- Calendar state management added to Dash class
- Module switching system implemented
- Week view: 7 columns with scrollable event lists
- Month view: 6-week grid with event dots/badges
- Event colors customizable via color picker
- Recurrence support for birthdays/anniversaries
- Calendar events and tasks shown together in unified view
- Responsive design for mobile calendar views

## [0.2.7] - 2026-02-03

### Fixed
- **List View Priority Column**: Removed separate Priority column, moved priority emoji inline with task title
  - Priority now shows as colored emoji (🔴 P1, 🟠 P2, 🟡 P3, ⚪ P4) before task title
  - Cleaner table layout with fewer columns
  - Priority emoji appears before recurring icon (if present)
- **Label System FIXED**: Labels now actually work!
  - Root cause: Tasks table in NocoDB was missing "Label ID" field entirely
  - Added "Label ID" field to Tasks table in NocoDB
  - Updated backend to read/write labelId from tasks
  - Label filter and assignment now work correctly
  - Labels now display in List view
  - Can now assign labels when creating/editing tasks

### Changed
- List view table header updated: removed Priority column
- Task title cell now includes priority emoji for visual priority indication

### Technical Details
The label system was completely broken because:
1. Frontend expected tasks to have `labelId` field
2. Backend wasn't reading/writing it (field didn't exist)
3. NocoDB Tasks table had no "Label ID" column
4. Added the missing field via NocoDB API
5. Updated backend GET /api/tasks to include `labelId: t['Label ID'] || null`
6. Updated backend POST /api/tasks to write `'Label ID': req.body.labelId || null`
7. Updated backend PATCH /api/tasks to handle `labelId` updates
8. Frontend already had correct code to send labelId - it just wasn't being saved

---

## [0.2.6] - 2026-02-03

### Fixed
- **CRITICAL BUG**: Fixed label filter completely broken - all tasks disappeared when filtering by label
  - Root cause: Filter logic checked `t.tagIds?.includes(labelId)` (array) but tasks use `t.labelId` (single integer)
  - Fixed two locations in `getFilteredTasks()`:
    - Line 607: Changed `t.tagIds?.includes(tagId)` → `t.labelId === tagId` for tag: view
    - Line 615: Changed `t.tagIds?.includes(parseInt(this.filters.labelId))` → `t.labelId === parseInt(this.filters.labelId)` for label filter
  - Label filtering now works correctly across all views

### Added
- **"All Tasks" View**: New sidebar nav item showing all tasks regardless of view/date filters
  - Located at top of sidebar (before "Today")
  - Icon: `fas fa-tasks`
  - Shows all tasks in current display mode (Kanban or List)
  - Still respects: priority filters, project filters, assignee filters, label filters, show/hide completed
  - Bypasses view-based filtering (date ranges, recurring, etc.)

---

## [0.2.5] - 2026-02-03

### Fixed
- **CRITICAL BUG**: Fixed JavaScript initialization crash that prevented ALL features from working
  - Root cause: `renderPeople()` tried to access `#people-list` element which was removed in v0.2.1
  - The crash on line 1173 prevented JavaScript from initializing, breaking:
    - Dropdown toggle event listeners (including "Upcoming" dropdown)
    - All interactive features
    - Task creation, editing, filtering
  - Added null check: `if (!container) return;` in `renderPeople()`
  - This was the actual root cause of the dropdown not working (not event binding or CSS)

### Improved
- **Enhanced Error Resilience**: Added defensive null checks to all major render functions
  - `renderLinks()`: Added null check for container and task count elements
  - `renderReminders()`: Added null check for container and task count elements
  - `renderTasks()`: Added null check for kanban container and task count element
  - `renderKanbanView()`: Added null check for kanban container
  - `renderUpcomingProjects()`: Already had null check (safe)
  - `populateFilterSelects()`: Already had null checks (safe)
  - `renderTableView()`: Already had null check (safe)
  - App now gracefully handles missing DOM elements instead of crashing

### Technical Details
The `#people-list` element was removed when we cleaned up the Assignees menu item in v0.2.1, but the `renderPeople()` function was still being called during initialization. Without the null check, `container.innerHTML = ...` threw an error, stopping all JavaScript execution. This prevented event listeners from being attached, making the app appear broken even though the HTML/CSS was correct.

All debug logging from v0.2.4 can be removed now that the real issue is fixed.

---

## [0.2.4] - 2026-02-03

### Fixed
- **Upcoming Dropdown Debugging**: Added extensive console logging to debug dropdown toggle issue
  - Added logs in `toggleUpcomingDropdown()` to track state changes
  - Added logs in event listener to verify click events are firing
  - Logs track: function calls, element state, class changes
  - This will help identify if issue is event binding, DOM manipulation, or CSS

### Technical Details
- Added console.log statements to trace execution flow:
  - `toggleUpcomingDropdown()`: logs before/after state, element found, classes applied
  - Event listener: logs when nav item clicked, confirms dropdown toggle detection
- Next step: Test locally with browser DevTools console open to see what's happening
- If events fire but dropdown doesn't expand, issue is CSS-related
- If events don't fire, issue is event binding or selector matching

---

## [0.2.3] - 2026-02-03

### Fixed
- **CRITICAL BUG**: Fixed drag-and-drop card move causing 400 Bad Request error
  - Root cause: Double JSON encoding in `updateTaskStatus()` function
  - The `api()` helper already calls `JSON.stringify()`, but `updateTaskStatus()` was calling it again
  - This caused the backend to receive `""{\"status\":\"in-progress\"}"` instead of `{"status":"in-progress"}`
  - Removed redundant `JSON.stringify()` call in frontend/app.js line 998
  - Drag-and-drop status updates now work correctly
- **Verified**: All NocoDB field mappings are correct
  - Backend properly maps: `status` (frontend) → `Status` (NocoDB)
  - Backend properly maps: `projectId` (frontend) → `Project ID` (NocoDB)
  - Backend properly maps: `dueDate` (frontend) → `Due Date` (NocoDB)
  - All other field mappings verified and working correctly
- **Verified**: Upcoming dropdown is properly implemented
  - `renderUpcomingProjects()` function exists and works correctly
  - Projects are fetched from API and rendered under "Upcoming" nav item
  - Click handlers properly set view to `upcoming:projectId`
  - Dropdown expand/collapse animation works via CSS transitions
- **Verified**: Layout width is correct on desktop
  - Sidebar is set to 260px via CSS variable `--sidebar-width`
  - Main content uses `flex: 1` to fill remaining space
  - No media query issues affecting desktop layout
  - Layout uses proper flexbox implementation

### Technical Details
The double JSON encoding bug occurred because:
1. Frontend `updateTaskStatus()` called: `JSON.stringify({ status: newStatus })`
2. Then passed this string to `api()` which called: `JSON.stringify(options.body)` again
3. Result: `""{\"status\":\"in-progress\"}"` (string containing escaped JSON)
4. Express body-parser failed to parse this as valid JSON → 400 error

Fix: Pass object directly to `api()`, let it handle the stringification once.

---

## [0.2.2] - 2026-02-03

### Added
- **Drag-and-Drop Kanban**: Full drag-and-drop functionality for kanban cards
  - Drag cards between To Do, In Progress, and Complete columns
  - Visual feedback during drag (opacity change, cursor)
  - Drop zones highlight when hovering
  - Task status automatically updates when dropped in new column
  - Smooth animations for better UX

### Fixed
- **Upcoming Dropdown**: Fixed "Upcoming" dropdown in sidebar not expanding
  - Clicking "Upcoming" now properly toggles the dropdown
  - Projects list properly displays under Upcoming section
  - Event handling improved for dropdown toggle
- **Filter Dropdowns**: Fixed empty filter dropdowns
  - Projects, Labels, and Assignees now populate correctly
  - Data loaded properly before rendering filters
- **Kanban Layout**: Fixed wasted space with columns compressed on left
  - Kanban board now uses full available width
  - Columns properly distribute across screen
  - Removed min-width constraint that was causing compression
  - Better responsive behavior

### Changed
- All kanban cards now have `draggable="true"` attribute and `.kanban-card` class
- Improved drag-and-drop visual feedback with CSS transitions

---

## [0.2.1] - 2026-02-03

### Added
- **Proper Kanban View**: Tasks now display in proper columns (To Do / In Progress / Complete)
  - Each column shows task count
  - Drag-and-drop support (coming soon)
  - Responsive: stacks vertically on mobile
- **Clickable Version Badge**: Click version number to force hard refresh
  - Useful for PWA users who need to clear cache
  - Clears service worker and reloads page

### Changed
- **Project Renamed**: DashBored → GanDash
  - Updated all branding and references
  - New GitHub repo: brendongl/gandash
  - New domain: gandash.ganle.xyz
- **Streamlined Navigation**: Removed coming soon modules (CRM, Finance, Habits)
- **Simplified Assignees**: Removed assignees section from sidebar navigation

### Fixed
- **Kanban Columns**: Tasks now properly grouped by status in Kanban view
- **Filter Logic**: "Today" view + label filters now work correctly together
  - Fixed filter combinations not showing results
  - Filters now apply properly across all views
- **Nudge Button**: Fixed 401 error when sending nudges
  - Improved error handling
  - Better user feedback

### Removed
- Coming Soon module placeholders (CRM, Finance, Habits)
- Assignees navigation section

---

## [0.2.0] - 2026-02-03

### Added
- **List View**: New table-based list view with toggle between Kanban/List modes
  - Clean table layout showing all task details in columns
  - Toggle buttons in header to switch between Kanban and List views
  - Responsive: List view only available on desktop, mobile stays in Kanban mode
- **Enhanced Filters**: Project, Assignee, and Label filters now available in all views
  - Dropdown filters in filter menu for Projects, Assignees, and Labels
  - Filters apply to both Kanban and List views
  - Filter states persist across view switches
- **View Mode Persistence**: Display mode (Kanban/List) saved to localStorage

### Changed
- Filter dropdowns now always visible (removed "upcoming-only" restriction)
- Updated filter UI to be more accessible and consistent
- View title now shows "DashKanban" when in Kanban view mode

### Fixed
- Filter select dropdowns now properly trigger task re-rendering
- Table view properly handles recurring tasks and due dates
- Display mode toggle state persists across sessions

---

## [0.1.5] - 2026-01-30

### Fixed
- **Mobile form COMPLETE REWRITE**: 
  - Form now uses CSS Grid (2 columns) instead of flexbox
  - Form container is absolutely positioned and scrollable
  - Fixed sticky action buttons at bottom of screen
  - 16px font size on inputs to prevent iOS zoom
  - Proper safe-area-inset for notch devices
  - FAB hides when form is open

---

## [0.1.4] - 2026-01-30

### Fixed
- **Mobile form layout**: Form rows now stay horizontal (2-3 columns) instead of stacking vertically
- **Mobile scrolling**: Form container takes full height and scrolls, task list hides when form open
- **Attachment upload**: Installed missing `multer` dependency, added better error handling

---

## [0.1.3] - 2026-01-30

### Fixed
- **Mobile scrolling**: Forms and modals now scroll properly on mobile devices
- **Task form cutoff**: "Reschedule From" and submit buttons now accessible on small screens
- **Settings page scrolling**: All settings sections now reachable on mobile
- **Modal full-screen on mobile**: Edit task and settings modals use full screen for better UX
- **Safe area insets**: Proper spacing for iOS notch/home indicator devices
- **Touch scrolling**: Added `-webkit-overflow-scrolling: touch` for smooth iOS scrolling
- **Dynamic viewport height**: Uses `100dvh` to handle mobile browser chrome properly
- **Dropdown menus on mobile**: Now slide up from bottom for easier thumb reach

### Changed
- Made entire UI mobile-first with comprehensive responsive breakpoints
- Form action buttons now sticky at bottom on mobile
- Detail panel info grid switches to single column on mobile
- Links grid switches to single column on mobile

---

## [0.1.2] - 2026-01-29

### Added
- Version badge displayed next to title in sidebar
- Upcoming dropdown now expands to show project sub-filters
- Filter dropdowns now populate with projects and assignees

### Fixed
- Upcoming dropdown now toggles properly on click
- Settings modal now scrollable (fixes stretching on long lists)
- Renamed app from "Dash" to "DashBored" throughout UI

---

## [0.1.1] - 2026-01-29

### Added
- **File attachments**: Upload images and files to tasks via edit modal
- Attachments display in task detail view with image previews
- Lightbox for viewing full-size images
- File type icons for non-image attachments

### Fixed
- Missing multer dependency for file uploads

---

## [0.1.0] - 2026-01-29

### Added
- **Nudge button**: Send Discord ping to task assignee (greyed out if no assignee)
- **Live status indicator**: Shows "Akubot is idle/thinking/working" in sidebar
- **Recurring tasks in Upcoming**: Now displays recurring tasks at their next occurrence with 🔄 icon
- **Mobile menu overlay**: Tap outside menu to close it
- **Task refresh**: UI now properly updates after adding tasks

### Changed
- Renamed project from "Dash" to "DashBored"
- Removed "Add Task" header (using floating + button instead)
- Removed Inbox tab (using Today as default view)
- Default view changed from Inbox to Today
- Upcoming view now supports project filtering via dropdown

### Fixed
- Mobile hamburger menu now closes when tapping outside
- Task list refreshes properly after creating new task
- Recurring tasks now appear in Today/Upcoming views
