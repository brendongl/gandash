# Changelog

All notable changes to GanDash will be documented in this file.

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
