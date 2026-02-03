const { test, expect } = require('@playwright/test');

test.describe('Kanban Board', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3002');
        
        // Enter PIN
        await page.click('button[data-num="1"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="7"]');
        
        // Click enter button to submit PIN
        await page.click('.pin-enter');
        
        // Wait for kanban board to load
        await page.waitForSelector('.kanban-board', { timeout: 10000 });
        
        // Wait for data to load
        await page.waitForTimeout(2000);
    });

    test('should load SortableJS library', async ({ page }) => {
        // Check if SortableJS is loaded
        const sortableLoaded = await page.evaluate(() => {
            return typeof Sortable !== 'undefined';
        });
        expect(sortableLoaded).toBe(true);
    });

    test('should initialize Sortable on kanban columns', async ({ page }) => {
        // Check console for initialization messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));
        
        // Trigger a page reload to see init messages
        await page.reload();
        await page.click('button[data-num="1"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="7"]');
        await page.click('.pin-enter');
        await page.waitForSelector('.kanban-board', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        // Check if initialization logs are present
        const hasInitLog = consoleMessages.some(msg => 
            msg.includes('Initializing SortableJS') || msg.includes('Setting up drag and drop')
        );
        expect(hasInitLog).toBe(true);
    });

    test('should have min-height on empty columns for drop zone', async ({ page }) => {
        // Check if .kanban-tasks containers have min-height
        const minHeight = await page.evaluate(() => {
            const tasks = document.querySelectorAll('.kanban-tasks');
            return Array.from(tasks).map(el => {
                const style = window.getComputedStyle(el);
                return {
                    minHeight: style.minHeight,
                    height: style.height
                };
            });
        });
        
        // All kanban-tasks should have min-height > 0
        minHeight.forEach(style => {
            expect(parseInt(style.minHeight)).toBeGreaterThan(0);
        });
    });

    test('should populate filter dropdowns', async ({ page }) => {
        // Open filter dropdown
        await page.click('#filter-btn');
        await page.waitForTimeout(500);
        
        // Check project filter
        const projectOptions = await page.locator('#filter-project option').count();
        console.log('Project options:', projectOptions);
        expect(projectOptions).toBeGreaterThan(1); // More than just "All Projects"
        
        // Check assignee filter
        const assigneeOptions = await page.locator('#filter-assignee option').count();
        console.log('Assignee options:', assigneeOptions);
        expect(assigneeOptions).toBeGreaterThan(1); // More than just "All Assignees"
        
        // Check label filter (may be 1 if no labels exist)
        const labelOptions = await page.locator('#filter-label option').count();
        console.log('Label options:', labelOptions);
        expect(labelOptions).toBeGreaterThanOrEqual(1); // At least "All Labels"
    });

    test('should switch between Kanban and List views', async ({ page }) => {
        // Verify we start in Kanban view
        const kanbanVisible = await page.locator('.kanban-board').isVisible();
        expect(kanbanVisible).toBe(true);
        
        const tableHidden = await page.locator('.tasks-table-container').isHidden();
        expect(tableHidden).toBe(true);
        
        // Click List view button
        await page.click('button[data-display-mode="list"]');
        await page.waitForTimeout(500);
        
        // Verify table is visible and kanban is hidden
        const tableVisible = await page.locator('.tasks-table-container').isVisible();
        expect(tableVisible).toBe(true);
        
        const kanbanHidden = await page.locator('.kanban-board').isHidden();
        expect(kanbanHidden).toBe(true);
        
        // Verify the button state changed
        const listBtnActive = await page.locator('button[data-display-mode="list"]').evaluate(el => 
            el.classList.contains('active')
        );
        expect(listBtnActive).toBe(true);
        
        // Switch back to Kanban
        await page.click('button[data-display-mode="kanban"]');
        await page.waitForTimeout(500);
        
        const kanbanVisibleAgain = await page.locator('.kanban-board').isVisible();
        expect(kanbanVisibleAgain).toBe(true);
        
        const tableHiddenAgain = await page.locator('.tasks-table-container').isHidden();
        expect(tableHiddenAgain).toBe(true);
    });

    test('should check for drag-over CSS classes (should not exist)', async ({ page }) => {
        // Check if old .drag-over classes exist in stylesheet
        const hasDragOverStyles = await page.evaluate(() => {
            // Check all stylesheets
            for (const sheet of document.styleSheets) {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    for (const rule of rules) {
                        if (rule.selectorText && rule.selectorText.includes('.drag-over')) {
                            return true;
                        }
                    }
                } catch (e) {
                    // CORS or other issues, skip
                }
            }
            return false;
        });
        
        expect(hasDragOverStyles).toBe(false);
    });

    test('should verify console logs for debugging', async ({ page }) => {
        const consoleMessages = [];
        const consoleErrors = [];
        
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            }
        });
        
        // Reload page
        await page.reload();
        await page.click('button[data-num="1"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="3"]');
        await page.click('button[data-num="7"]');
        await page.click('.pin-enter');
        await page.waitForSelector('.kanban-board', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        // Check for specific debug logs we added
        const hasPopulateLog = consoleMessages.some(msg => msg.includes('populateFilterSelects() called'));
        const hasProjectsLog = consoleMessages.some(msg => msg.includes('Projects:'));
        const hasSortableLog = consoleMessages.some(msg => msg.includes('SortableJS loaded:'));
        
        console.log('Has populate log:', hasPopulateLog);
        console.log('Has projects log:', hasProjectsLog);
        console.log('Has sortable log:', hasSortableLog);
        
        // Log any errors
        if (consoleErrors.length > 0) {
            console.log('Console errors:', consoleErrors);
        }
        
        // Verify key logs are present
        expect(hasPopulateLog).toBe(true);
        expect(hasSortableLog).toBe(true);
    });

    test('should test view mode toggle with console logs', async ({ page }) => {
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));
        
        // Try switching views and capture logs
        await page.click('button[data-display-mode="list"]');
        await page.waitForTimeout(1000);
        
        // Check for our debug logs
        const hasSetDisplayModeLog = consoleMessages.some(msg => msg.includes('setDisplayMode() called with mode: list'));
        const hasRenderTasksLog = consoleMessages.some(msg => msg.includes('renderTasks() called'));
        const hasSwitchingLog = consoleMessages.some(msg => msg.includes('Switching to LIST view'));
        
        console.log('Console messages:', consoleMessages.filter(msg => 
            msg.includes('setDisplayMode') || 
            msg.includes('renderTasks') || 
            msg.includes('Switching')
        ));
        
        expect(hasSetDisplayModeLog).toBe(true);
        expect(hasRenderTasksLog).toBe(true);
        expect(hasSwitchingLog).toBe(true);
    });
});
