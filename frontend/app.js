// GanDash - Personal Knowledge Manager Frontend
const API_URL = window.location.origin + '/api';

// Pincode configuration
const PINCODE = '1337';
const PINCODE_AUTH_KEY = 'gandash_authenticated';

class Dash {
    constructor() {
        this.tasks = [];
        this.reminders = [];
        this.projects = [];
        this.tags = [];
        this.people = [
            { id: 1, name: 'Brendon', discordId: '147649565330243584' },
            { id: 2, name: 'Ivy', discordId: '623156654199930882' }
        ];
        this.links = JSON.parse(localStorage.getItem('dash_links') || '[]');
        
        // Default links
        if (this.links.length === 0) {
            this.links = [
                { id: 1, name: 'Ollama WebUI', url: 'https://ollama.ganle.xyz', icon: 'fa-robot', color: '#22c55e' }
            ];
            this.saveLinks();
        }
        this.currentView = 'today';
        this.currentTask = null;
        this.upcomingDropdownExpanded = false;
        this.upcomingProjectFilter = null; // Filter upcoming by project ID
        this.pendingCompleteTaskId = null;
        this.quickAddType = 'project';
        this.quickAddColor = '#e53935';
        this.timezone = localStorage.getItem('gandash_timezone') || 'Asia/Ho_Chi_Minh';
        this.defaultRemindTime = localStorage.getItem('gandash_remind_time') || '10:00';
        this.discordChannel = localStorage.getItem('gandash_discord_channel') || '1465902062146555915';
        
        // Filter & Sort state
        this.sortBy = localStorage.getItem('gandash_sort') || 'priority';
        this.filters = {
            showCompleted: localStorage.getItem('gandash_filter_completed') === 'true',
            priorities: JSON.parse(localStorage.getItem('gandash_filter_priorities') || '[1,2,3,4]'),
            projectId: null,
            assigneeId: null,
            labelId: null
        };
        
        // Display mode (kanban or list)
        this.displayMode = localStorage.getItem('gandash_display_mode') || 'kanban';
        
        // Pincode state
        this.enteredPin = '';
        
        this.init();
    }

    async init() {
        // Check authentication
        if (!this.checkAuth()) {
            this.showPincodeScreen();
            this.bindPincodeEvents();
            return;
        }
        
        // Authenticated - show app
        this.showApp();
        this.bindEvents();
        await this.loadData();
    }
    
    // ==================== PINCODE AUTHENTICATION ====================
    
    checkAuth() {
        // Check if already authenticated this session (persists in localStorage per device)
        return localStorage.getItem(PINCODE_AUTH_KEY) === 'true';
    }
    
    showPincodeScreen() {
        document.getElementById('pincode-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        document.querySelector('.pincode-label').textContent = 'Enter PIN to continue';
    }
    
    showApp() {
        document.getElementById('pincode-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        this.startAkubotStatusPolling();
    }
    
    // ==================== AKUBOT STATUS POLLING ====================
    
    startAkubotStatusPolling() {
        // Initial fetch
        this.fetchAkubotStatus();
        // Poll every 5 seconds
        this.akubotStatusInterval = setInterval(() => this.fetchAkubotStatus(), 5000);
    }
    
    async fetchAkubotStatus() {
        try {
            const res = await fetch(`${API_URL}/akubot/status`);
            const data = await res.json();
            this.updateAkubotStatusUI(data);
        } catch (error) {
            // On error, show idle
            this.updateAkubotStatusUI({ status: 'idle' });
        }
    }
    
    updateAkubotStatusUI(data) {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (!dot || !text) return;
        
        // Remove all status classes
        dot.classList.remove('idle', 'thinking', 'working');
        
        // Add appropriate class and update text
        switch (data.status) {
            case 'thinking':
                dot.classList.add('thinking');
                text.textContent = data.task ? `Thinking: ${data.task}` : 'Akubot is thinking...';
                break;
            case 'working':
                dot.classList.add('working');
                text.textContent = data.task ? `Working: ${data.task}` : 'Akubot is working...';
                break;
            default:
                dot.classList.add('idle');
                text.textContent = 'Akubot is idle';
        }
    }
    
    updatePinDisplay() {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < this.enteredPin.length);
        });
    }
    
    handlePinEntry(num) {
        if (this.enteredPin.length >= 4) return;
        this.enteredPin += num;
        this.updatePinDisplay();
        document.getElementById('pincode-error').classList.add('hidden');
    }
    
    handlePinBackspace() {
        if (this.enteredPin.length > 0) {
            this.enteredPin = this.enteredPin.slice(0, -1);
            this.updatePinDisplay();
        }
    }
    
    validatePin() {
        if (this.enteredPin === PINCODE) {
            // Correct PIN - save auth and show app
            localStorage.setItem(PINCODE_AUTH_KEY, 'true');
            this.showApp();
            this.bindEvents();
            this.loadData();
        } else {
            // Wrong PIN
            this.showPinError('Incorrect PIN');
        }
    }
    
    showPinError(message) {
        const errorEl = document.getElementById('pincode-error');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        this.enteredPin = '';
        this.updatePinDisplay();
    }
    
    bindPincodeEvents() {
        document.querySelectorAll('.pin-btn[data-num]').forEach(btn => {
            btn.addEventListener('click', () => this.handlePinEntry(btn.dataset.num));
        });
        
        document.querySelector('.pin-backspace')?.addEventListener('click', () => this.handlePinBackspace());
        document.querySelector('.pin-enter')?.addEventListener('click', () => this.validatePin());
        
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('pincode-screen').classList.contains('hidden')) return;
            if (e.key >= '0' && e.key <= '9') this.handlePinEntry(e.key);
            else if (e.key === 'Backspace') this.handlePinBackspace();
            else if (e.key === 'Enter') this.validatePin();
        });
    }

    // API Helpers
    async api(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            });
            
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.toast(error.message, 'error');
            throw error;
        }
    }

    // Data Loading
    async loadData() {
        this.showLoading(true);
        try {
            const [tasks, projects, tags, people, reminders] = await Promise.all([
                this.api('/tasks'),
                this.api('/projects'),
                this.api('/tags'),
                this.api('/people').catch(() => this.people), // Fallback to defaults
                this.api('/reminders').catch(() => [])
            ]);
            
            this.tasks = tasks;
            this.projects = projects;
            this.tags = tags;
            this.reminders = reminders || [];
            if (people && people.length) this.people = people;
            
            this.renderAll();
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            this.showLoading(false);
        }
    }

    // Mobile menu helpers
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('visible', sidebar.classList.contains('open'));
        overlay?.classList.toggle('hidden', !sidebar.classList.contains('open'));
    }
    
    closeMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('open');
        overlay?.classList.remove('visible');
        overlay?.classList.add('hidden');
    }

    // Task CRUD
    async createTask(data) {
        try {
            const response = await this.api('/tasks', { method: 'POST', body: data });
            // Merge API response with input data to ensure all fields are present
            const newTask = { 
                ...data, 
                ...response, 
                id: response.id || response, 
                status: response.status || 'pending',
                createdAt: response.createdAt || new Date().toISOString()
            };
            this.tasks.push(newTask);
            this.renderTasks();
            this.updateCounts();
            this.toast('Task created!', 'success');
            return response;
        } catch (error) {
            this.toast('Failed to create task', 'error');
        }
    }

    async updateTask(id, data) {
        try {
            await this.api(`/tasks/${id}`, { method: 'PATCH', body: data });
            const idx = this.tasks.findIndex(t => t.id === id);
            if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], ...data };
            this.renderTasks();
            this.updateCounts();
            return true;
        } catch (error) {
            this.toast('Failed to update task', 'error');
        }
    }

    async deleteTask(id) {
        try {
            await this.api(`/tasks/${id}`, { method: 'DELETE' });
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.renderTasks();
            this.updateCounts();
            this.closeDetailPanel();
            this.toast('Task deleted', 'success');
        } catch (error) {
            this.toast('Failed to delete task', 'error');
        }
    }

    // Reminder CRUD
    async createReminder(data) {
        try {
            const reminder = await this.api('/reminders', { method: 'POST', body: data });
            this.reminders.push({ ...data, id: reminder.id });
            this.renderReminders();
            this.updateCounts();
            this.toast('Reminder created!', 'success');
            return reminder;
        } catch (error) {
            this.toast('Failed to create reminder', 'error');
        }
    }

    async deleteReminder(id) {
        try {
            await this.api(`/reminders/${id}`, { method: 'DELETE' });
            this.reminders = this.reminders.filter(r => r.id !== id);
            this.renderReminders();
            this.updateCounts();
            this.toast('Reminder deleted', 'success');
        } catch (error) {
            this.toast('Failed to delete reminder', 'error');
        }
    }

    // Confirm complete flow
    promptCompleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        
        this.pendingCompleteTaskId = id;
        document.getElementById('confirm-task-title').textContent = task.title;
        document.getElementById('confirm-complete-modal').classList.remove('hidden');
    }

    async confirmCompleteTask() {
        if (!this.pendingCompleteTaskId) return;
        
        const id = this.pendingCompleteTaskId;
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
        
        await this.updateTask(id, {
            status: newStatus,
            completedAt,
            recurrenceRule: task.recurrenceRule,
            recurrenceBase: task.recurrenceBase
        });
        
        this.closeConfirmModal();
        
        // Update view panel if open
        if (this.currentTask?.id === id) {
            this.currentTask.status = newStatus;
            this.renderViewMode();
        }
    }

    closeConfirmModal() {
        document.getElementById('confirm-complete-modal').classList.add('hidden');
        this.pendingCompleteTaskId = null;
    }

    // Subtasks
    async loadSubtasks(taskId) {
        try {
            return await this.api(`/tasks/${taskId}/subtasks`);
        } catch (error) {
            return [];
        }
    }

    async createSubtask(taskId, title) {
        try {
            return await this.api(`/tasks/${taskId}/subtasks`, {
                method: 'POST',
                body: { title }
            });
        } catch (error) {
            this.toast('Failed to create subtask', 'error');
        }
    }

    async toggleSubtask(id, completed) {
        try {
            await this.api(`/subtasks/${id}`, {
                method: 'PATCH',
                body: { completed }
            });
        } catch (error) {
            this.toast('Failed to update subtask', 'error');
        }
    }

    async deleteSubtask(id) {
        try {
            await this.api(`/subtasks/${id}`, { method: 'DELETE' });
        } catch (error) {
            this.toast('Failed to delete subtask', 'error');
        }
    }

    // Projects & Tags
    async createProject(data) {
        try {
            const project = await this.api('/projects', { method: 'POST', body: data });
            this.projects.push({ ...data, id: project.id });
            this.populateSelects();
            this.toast('Project created!', 'success');
            return project;
        } catch (error) {
            this.toast('Failed to create project', 'error');
        }
    }

    async createTag(data) {
        try {
            const tag = await this.api('/tags', { method: 'POST', body: data });
            this.tags.push({ ...data, id: tag.id });
            this.populateSelects();
            this.toast('Label created!', 'success');
            return tag;
        } catch (error) {
            this.toast('Failed to create label', 'error');
        }
    }

    async deleteProject(id) {
        try {
            await this.api(`/projects/${id}`, { method: 'DELETE' });
            this.projects = this.projects.filter(p => p.id !== id);
            this.populateSelects();
            this.renderSettingsLists();
        } catch (error) {
            this.toast('Failed to delete project', 'error');
        }
    }

    async deleteTag(id) {
        try {
            await this.api(`/tags/${id}`, { method: 'DELETE' });
            this.tags = this.tags.filter(t => t.id !== id);
            this.populateSelects();
            this.renderSettingsLists();
        } catch (error) {
            this.toast('Failed to delete label', 'error');
        }
    }

    // Calculate next occurrence for a recurring task
    calculateNextOccurrence(task) {
        if (!task.recurrenceRule) return null;
        
        // Start from the task's due date, or today if no due date
        const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let next = new Date(baseDate);
        const rule = task.recurrenceRule.toLowerCase();
        
        // Helper to advance the date by one interval
        const advance = (date) => {
            switch (rule) {
                case 'daily':
                    date.setDate(date.getDate() + 1);
                    break;
                case 'weekly':
                    date.setDate(date.getDate() + 7);
                    break;
                case 'biweekly':
                    date.setDate(date.getDate() + 14);
                    break;
                case 'monthly':
                    date.setMonth(date.getMonth() + 1);
                    break;
                case 'quarterly':
                    date.setMonth(date.getMonth() + 3);
                    break;
                case 'yearly':
                    date.setFullYear(date.getFullYear() + 1);
                    break;
                default:
                    // Custom format: "every X days/weeks/months"
                    const match = rule.match(/every\s+(\d+)\s+(day|week|month|year)s?/i);
                    if (match) {
                        const [, num, unit] = match;
                        const n = parseInt(num);
                        switch (unit.toLowerCase()) {
                            case 'day': date.setDate(date.getDate() + n); break;
                            case 'week': date.setDate(date.getDate() + n * 7); break;
                            case 'month': date.setMonth(date.getMonth() + n); break;
                            case 'year': date.setFullYear(date.getFullYear() + n); break;
                        }
                    }
            }
            return date;
        };
        
        // Advance until we find a date >= today
        let iterations = 0;
        while (next < today && iterations < 365) {
            advance(next);
            iterations++;
        }
        
        return next;
    }

    // Filtering
    getFilteredTasks() {
        let filtered = [...this.tasks];
        const today = this.getTodayInTimezone();
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const nextWeekDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        // Apply view-based filtering
        const isCompletedView = this.currentView === 'completed';

        const isUpcomingView = this.currentView === 'upcoming' || this.currentView.startsWith('upcoming:');

        switch (this.currentView) {
            case 'all':
                // Show all tasks, no view-based filtering
                if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                break;
            case 'today':
                filtered = filtered.filter(t => {
                    // Regular tasks: check dueDate
                    if (t.dueDate?.split('T')[0] === today) return true;
                    // Recurring tasks: check if next occurrence is today
                    if (t.recurrenceRule && t.status !== 'completed') {
                        const nextOccurrence = this.calculateNextOccurrence(t);
                        if (nextOccurrence) {
                            const nextDate = nextOccurrence.toISOString().split('T')[0];
                            return nextDate === today;
                        }
                    }
                    return false;
                });
                if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                break;
            case 'upcoming':
                filtered = filtered.filter(t => {
                    // Regular non-recurring tasks: check dueDate is in upcoming week
                    if (!t.recurrenceRule && t.dueDate) {
                        const dueStr = t.dueDate.split('T')[0];
                        return dueStr > today && dueStr <= nextWeek;
                    }
                    // Recurring tasks: check if next occurrence is in upcoming week
                    if (t.recurrenceRule && t.status !== 'completed') {
                        const nextOccurrence = this.calculateNextOccurrence(t);
                        if (nextOccurrence) {
                            const nextStr = nextOccurrence.toISOString().split('T')[0];
                            return nextStr >= today && nextStr <= nextWeek;
                        }
                    }
                    return false;
                });
                if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                break;
            case 'recurring':
                filtered = filtered.filter(t => t.recurrenceRule);
                if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                break;
            case 'completed':
                filtered = filtered.filter(t => t.status === 'completed');
                break;
            default:
                if (this.currentView.startsWith('upcoming:')) {
                    // Upcoming filtered by project
                    const projectId = parseInt(this.currentView.split(':')[1]);
                    filtered = filtered.filter(t => {
                        if (!t.recurrenceRule && t.dueDate) {
                            const dueStr = t.dueDate.split('T')[0];
                            return dueStr > today && t.projectId === projectId;
                        }
                        if (t.recurrenceRule && t.status !== 'completed') {
                            const nextOccurrence = this.calculateNextOccurrence(t);
                            if (nextOccurrence && t.projectId === projectId) {
                                const nextStr = nextOccurrence.toISOString().split('T')[0];
                                return nextStr >= today;
                            }
                        }
                        return false;
                    });
                    if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                } else if (this.currentView.startsWith('project:')) {
                    const projectId = parseInt(this.currentView.split(':')[1]);
                    filtered = filtered.filter(t => t.projectId === projectId);
                    if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                } else if (this.currentView.startsWith('tag:')) {
                    const tagId = parseInt(this.currentView.split(':')[1]);
                    filtered = filtered.filter(t => t.labelId === tagId);
                    if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                } else if (this.currentView.startsWith('person:')) {
                    const personId = parseInt(this.currentView.split(':')[1]);
                    filtered = filtered.filter(t => t.assigneeId === personId);
                    if (!this.filters.showCompleted) filtered = filtered.filter(t => t.status !== 'completed');
                }
        }
        
        // Apply additional filters (all views)
        if (this.filters.projectId) {
            filtered = filtered.filter(t => t.projectId === parseInt(this.filters.projectId));
        }
        if (this.filters.assigneeId) {
            filtered = filtered.filter(t => t.assigneeId === parseInt(this.filters.assigneeId));
        }
        if (this.filters.labelId) {
            filtered = filtered.filter(t => t.labelId === parseInt(this.filters.labelId));
        }
        
        // Apply priority filter (except on completed view)
        if (!isCompletedView) {
            filtered = filtered.filter(t => this.filters.priorities.includes(t.priority || 4));
        }

        // Search
        const search = document.getElementById('search-input')?.value?.toLowerCase();
        if (search) {
            filtered = filtered.filter(t => 
                t.title?.toLowerCase().includes(search) ||
                t.description?.toLowerCase().includes(search)
            );
        }

        // Helper to get effective due date (uses next occurrence for recurring tasks)
        const getEffectiveDueDate = (task) => {
            if (task.recurrenceRule && task.status !== 'completed') {
                const next = this.calculateNextOccurrence(task);
                return next || (task.dueDate ? new Date(task.dueDate) : null);
            }
            return task.dueDate ? new Date(task.dueDate) : null;
        };

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'priority':
                    if (a.priority !== b.priority) return (a.priority || 4) - (b.priority || 4);
                    // Secondary sort by effective due date
                    const aDateP = getEffectiveDueDate(a);
                    const bDateP = getEffectiveDueDate(b);
                    if (!aDateP && !bDateP) return 0;
                    if (!aDateP) return 1;
                    if (!bDateP) return -1;
                    return aDateP - bDateP;
                    
                case 'dueDate':
                    const aDate = getEffectiveDueDate(a);
                    const bDate = getEffectiveDueDate(b);
                    if (!aDate && !bDate) return 0;
                    if (!aDate) return 1;
                    if (!bDate) return -1;
                    return aDate - bDate;
                    
                case 'name':
                    return (a.title || '').localeCompare(b.title || '');
                    
                case 'created':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                    
                default:
                    return 0;
            }
        });

        return filtered;
    }
    
    // ==================== LINKS ====================
    
    saveLinks() {
        localStorage.setItem('dash_links', JSON.stringify(this.links));
    }
    
    addLink(name, url, icon = 'fa-link', color = '#6366f1') {
        const id = Math.max(0, ...this.links.map(l => l.id)) + 1;
        this.links.push({ id, name, url, icon, color });
        this.saveLinks();
        if (this.currentView === 'links') this.renderLinks();
        this.toast('Link added!', 'success');
    }
    
    deleteLink(id) {
        this.links = this.links.filter(l => l.id !== id);
        this.saveLinks();
        this.renderLinks();
        this.toast('Link deleted', 'success');
    }
    
    renderLinks() {
        const container = document.getElementById('tasks-list');
        const emptyState = document.getElementById('empty-state');
        const taskCount = document.getElementById('task-count');
        
        if (!container) return; // Guard against missing elements
        if (taskCount) taskCount.textContent = `${this.links.length} link${this.links.length !== 1 ? 's' : ''}`;
        
        if (this.links.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.innerHTML = `
                    <i class="fas fa-link" style="font-size: 3rem; opacity: 0.3;"></i>
                    <h3>No links yet</h3>
                    <p>Add quick links to your favorite services</p>
                `;
            }
            return;
        }
        
        emptyState?.classList.add('hidden');
        container.innerHTML = `
            <div class="links-grid">
                ${this.links.map(link => `
                    <a href="${this.escapeHtml(link.url)}" target="_blank" class="link-card" style="--link-color: ${link.color}">
                        <div class="link-icon" style="background: ${link.color}20; color: ${link.color}">
                            <i class="fas ${link.icon}"></i>
                        </div>
                        <div class="link-info">
                            <div class="link-name">${this.escapeHtml(link.name)}</div>
                            <div class="link-url">${this.escapeHtml(link.url.replace(/^https?:\/\//, ''))}</div>
                        </div>
                        <button class="link-delete" onclick="event.preventDefault(); event.stopPropagation(); app.deleteLink(${link.id});" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </a>
                `).join('')}
                <button class="link-card link-add" onclick="app.showAddLinkModal()">
                    <div class="link-icon">
                        <i class="fas fa-plus"></i>
                    </div>
                    <div class="link-info">
                        <div class="link-name">Add Link</div>
                    </div>
                </button>
            </div>
        `;
    }
    
    showAddLinkModal() {
        const name = prompt('Link name:');
        if (!name) return;
        const url = prompt('URL:');
        if (!url) return;
        this.addLink(name, url);
    }
    
    // ==================== FILTER & SORT ====================
    
    setSort(sortBy) {
        this.sortBy = sortBy;
        localStorage.setItem('gandash_sort', sortBy);
        
        // Update UI
        document.querySelectorAll('#sort-menu .dropdown-item').forEach(item => {
            item.classList.toggle('active', item.dataset.sort === sortBy);
        });
        
        this.renderTasks();
        this.closeDropdowns();
    }
    
    toggleFilter(filterKey, value) {
        if (filterKey === 'showCompleted') {
            this.filters.showCompleted = value;
            localStorage.setItem('gandash_filter_completed', value);
        } else if (filterKey.startsWith('p')) {
            const priority = parseInt(filterKey.slice(1));
            if (value) {
                if (!this.filters.priorities.includes(priority)) {
                    this.filters.priorities.push(priority);
                }
            } else {
                this.filters.priorities = this.filters.priorities.filter(p => p !== priority);
            }
            localStorage.setItem('gandash_filter_priorities', JSON.stringify(this.filters.priorities));
        }
        
        this.updateFilterIndicator();
        this.renderTasks();
    }
    
    updateFilterIndicator() {
        const filterBtn = document.getElementById('filter-btn');
        const hasActiveFilters = this.filters.showCompleted || 
            this.filters.priorities.length < 4;
        filterBtn.classList.toggle('filter-active', hasActiveFilters);
    }
    
    initFilterUI() {
        // Set initial checkbox states
        document.getElementById('filter-show-completed').checked = this.filters.showCompleted;
        document.getElementById('filter-p1').checked = this.filters.priorities.includes(1);
        document.getElementById('filter-p2').checked = this.filters.priorities.includes(2);
        document.getElementById('filter-p3').checked = this.filters.priorities.includes(3);
        document.getElementById('filter-p4').checked = this.filters.priorities.includes(4);
        
        // Set initial sort
        document.querySelectorAll('#sort-menu .dropdown-item').forEach(item => {
            item.classList.toggle('active', item.dataset.sort === this.sortBy);
        });
        
        this.updateFilterIndicator();
    }
    
    toggleDropdown(dropdownId) {
        const menu = document.getElementById(dropdownId);
        const isOpen = menu.classList.contains('show');
        
        // Close all dropdowns first
        this.closeDropdowns();
        
        // Toggle the clicked one
        if (!isOpen) {
            menu.classList.add('show');
        }
    }
    
    closeDropdowns() {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    }

    // Rendering
    renderAll() {
        this.renderTasks();
        this.renderPeople();
        this.populateSelects();
        this.renderUpcomingProjects();
        this.populateFilterSelects();
        this.updateCounts();
    }

    renderTasks() {
        const kanbanContainer = document.getElementById('tasks-list');
        const tableContainer = document.getElementById('tasks-table-container');
        const emptyState = document.getElementById('empty-state');
        const taskCount = document.getElementById('task-count');
        const filtered = this.getFilteredTasks();

        if (!kanbanContainer) return; // Guard against missing elements
        if (taskCount) taskCount.textContent = `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            kanbanContainer.innerHTML = '';
            if (tableContainer) {
                document.getElementById('tasks-table-body').innerHTML = '';
            }
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');
        
        // Render based on display mode
        if (this.displayMode === 'list') {
            kanbanContainer.classList.add('hidden');
            tableContainer?.classList.remove('hidden');
            this.renderTableView(filtered);
        } else {
            kanbanContainer.classList.remove('hidden');
            tableContainer?.classList.add('hidden');
            this.renderKanbanView(filtered);
        }
    }

    renderKanbanView(tasks) {
        const kanbanContainer = document.getElementById('tasks-list');
        if (!kanbanContainer) return; // Guard against missing elements
        
        // Group tasks by status
        const todoTasks = tasks.filter(t => t.status === 'pending' || t.status === 'todo' || !t.status);
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress');
        const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done');

        kanbanContainer.innerHTML = `
            <div class="kanban-board">
                <div class="kanban-column" data-status="todo">
                    <div class="kanban-header">
                        <h3>To Do</h3>
                        <span class="kanban-count">${todoTasks.length}</span>
                    </div>
                    <div class="kanban-tasks" data-status="todo">
                        ${todoTasks.map(task => this.renderTaskItem(task)).join('')}
                    </div>
                </div>
                <div class="kanban-column" data-status="in-progress">
                    <div class="kanban-header">
                        <h3>In Progress</h3>
                        <span class="kanban-count">${inProgressTasks.length}</span>
                    </div>
                    <div class="kanban-tasks" data-status="in-progress">
                        ${inProgressTasks.map(task => this.renderTaskItem(task)).join('')}
                    </div>
                </div>
                <div class="kanban-column" data-status="completed">
                    <div class="kanban-header">
                        <h3>Complete</h3>
                        <span class="kanban-count">${completedTasks.length}</span>
                    </div>
                    <div class="kanban-tasks" data-status="completed">
                        ${completedTasks.map(task => this.renderTaskItem(task)).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Setup drag and drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-tasks');
        
        // Setup draggable cards
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
            });
            
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });
        });
        
        // Setup drop zones
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const draggingCard = document.querySelector('.dragging');
                const afterElement = this.getDragAfterElement(column, e.clientY);
                
                if (afterElement == null) {
                    column.appendChild(draggingCard);
                } else {
                    column.insertBefore(draggingCard, afterElement);
                }
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggingCard = document.querySelector('.dragging');
                if (!draggingCard) return;
                
                const newStatus = column.dataset.status;
                const taskId = parseInt(draggingCard.dataset.id);
                
                // Update task status
                this.updateTaskStatus(taskId, newStatus);
            });
            
            column.addEventListener('dragenter', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', (e) => {
                if (e.target === column) {
                    column.classList.remove('drag-over');
                }
            });
        });
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    async updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Update local state
        task.status = newStatus;
        
        // Update in database
        try {
            await this.api(`/tasks/${taskId}`, {
                method: 'PATCH',
                body: { status: newStatus }
            });
            
            this.showToast('Task status updated', 'success');
        } catch (error) {
            console.error('Failed to update task status:', error);
            this.showToast('Failed to update task status', 'error');
            // Revert local state
            await this.loadData();
        }
    }

    renderTaskItem(task) {
        const project = this.projects.find(p => p.id === task.projectId);
        const assignee = this.people.find(p => p.id === task.assigneeId);
        const isCompleted = task.status === 'completed';
        const priorityClass = `p${task.priority || 4}`;
        
        // For recurring tasks, calculate and show next occurrence
        let displayDate = task.dueDate;
        let dueClass = this.getDueClass(task.dueDate);
        
        if (task.recurrenceRule && !isCompleted) {
            const nextOccurrence = this.calculateNextOccurrence(task);
            if (nextOccurrence) {
                displayDate = nextOccurrence.toISOString();
                dueClass = this.getDueClass(displayDate);
            }
        }

        return `
            <div class="task-item kanban-card ${isCompleted ? 'completed' : ''}" data-id="${task.id}" draggable="true">
                <button class="checkbox ${isCompleted ? 'checked' : ''} ${priorityClass}"
                        onclick="app.promptCompleteTask(${task.id}); event.stopPropagation();"></button>
                <div class="task-content" onclick="app.openDetailPanel(${task.id})">
                    <div class="task-title">${task.recurrenceRule ? '🔄 ' : ''}${this.escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        ${displayDate ? `<span class="task-due ${dueClass}"><i class="fas fa-calendar"></i> ${this.formatDate(displayDate)}</span>` : ''}
                        ${project ? `<span class="task-project"><span class="color-dot" style="background:${project.color}"></span> ${this.escapeHtml(project.name)}</span>` : ''}
                        ${assignee ? `<span class="task-assignee"><i class="fas fa-user"></i> ${this.escapeHtml(assignee.name)}</span>` : ''}
                        ${task.recurrenceRule ? `<span class="task-recurrence"><i class="fas fa-repeat"></i> ${task.recurrenceRule}</span>` : ''}
                        ${task.notifyEnabled ? `<span class="task-notify"><i class="fas fa-bell"></i></span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderTableView(tasks) {
        const tbody = document.getElementById('tasks-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = tasks.map(task => this.renderTableRow(task)).join('');
    }

    renderTableRow(task) {
        const project = this.projects.find(p => p.id === task.projectId);
        const assignee = this.people.find(p => p.id === task.assigneeId);
        const label = this.tags.find(t => t.id === task.labelId);
        const isCompleted = task.status === 'completed' || task.status === 'done';
        const priorityClass = `p${task.priority || 4}`;
        const priorityLabels = { 1: 'P1 - Urgent', 2: 'P2 - High', 3: 'P3 - Medium', 4: 'P4 - Low' };
        
        // Calculate display date for recurring tasks
        let displayDate = task.dueDate;
        let dueClass = this.getDueClass(task.dueDate);
        
        if (task.recurrenceRule && !isCompleted) {
            const nextOccurrence = this.calculateNextOccurrence(task);
            if (nextOccurrence) {
                displayDate = nextOccurrence.toISOString();
                dueClass = this.getDueClass(displayDate);
            }
        }

        return `
            <tr class="${isCompleted ? 'completed' : ''}" onclick="app.openDetailPanel(${task.id})">
                <td class="table-checkbox">
                    <button class="checkbox ${isCompleted ? 'checked' : ''} ${priorityClass}"
                            onclick="app.promptCompleteTask(${task.id}); event.stopPropagation();"></button>
                </td>
                <td>
                    <div class="table-task-cell">
                        <div class="table-task-title">${task.recurrenceRule ? '🔄 ' : ''}${this.escapeHtml(task.title)}</div>
                        ${task.description ? `<div class="table-task-description">${this.escapeHtml(task.description)}</div>` : ''}
                    </div>
                </td>
                <td>
                    ${displayDate ? `<div class="table-due-date ${dueClass}"><i class="fas fa-calendar"></i> ${this.formatDate(displayDate)}</div>` : '<span style="color: var(--text-muted)">No date</span>'}
                </td>
                <td>
                    <div class="table-priority">
                        <span class="priority-dot ${priorityClass}"></span>
                        ${priorityLabels[task.priority || 4]}
                    </div>
                </td>
                <td>
                    ${project ? `<div class="table-project"><span class="color-dot" style="background:${project.color}"></span> ${this.escapeHtml(project.name)}</div>` : '<span style="color: var(--text-muted)">None</span>'}
                </td>
                <td>
                    ${assignee ? `<div class="table-assignee"><i class="fas fa-user"></i> ${this.escapeHtml(assignee.name)}</div>` : '<span style="color: var(--text-muted)">Unassigned</span>'}
                </td>
                <td>
                    ${label ? `<div class="table-label"><span class="color-dot" style="background:${label.color}"></span> ${this.escapeHtml(label.name)}</div>` : '<span style="color: var(--text-muted)">None</span>'}
                </td>
                <td>
                    <span class="table-status-badge ${task.status}">${task.status}</span>
                </td>
            </tr>
        `;
    }

    setDisplayMode(mode) {
        this.displayMode = mode;
        localStorage.setItem('gandash_display_mode', mode);
        
        // Update toggle button states
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.displayMode === mode);
        });
        
        // Re-render tasks
        this.renderTasks();
    }

    renderReminders() {
        if (this.currentView !== 'reminders') return;
        
        const container = document.getElementById('tasks-list');
        const emptyState = document.getElementById('empty-state');
        const taskCount = document.getElementById('task-count');
        
        if (!container) return; // Guard against missing elements
        if (taskCount) taskCount.textContent = `${this.reminders.length} reminder${this.reminders.length !== 1 ? 's' : ''}`;

        if (this.reminders.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.innerHTML = `
                    <i class="fas fa-bell" style="font-size: 3rem; opacity: 0.3;"></i>
                    <p>No reminders yet</p>
                    <p style="opacity:0.6">Chat with me to create reminders like "remind me to call John tomorrow"</p>
                `;
            }
            return;
        }

        emptyState?.classList.add('hidden');
        container.innerHTML = this.reminders.map(r => this.renderReminderItem(r)).join('');
    }

    renderReminderItem(reminder) {
        const dueClass = this.getDueClass(reminder.dueDate);
        return `
            <div class="task-item reminder-item" data-id="${reminder.id}">
                <div class="reminder-icon">
                    <i class="fas fa-bell"></i>
                </div>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(reminder.text)}</div>
                    <div class="task-meta">
                        ${reminder.dueDate ? `<span class="task-due ${dueClass}"><i class="fas fa-calendar"></i> ${this.formatDate(reminder.dueDate)}</span>` : ''}
                        ${reminder.dueTime ? `<span><i class="fas fa-clock"></i> ${reminder.dueTime}</span>` : ''}
                        <span style="opacity:0.5">via ${reminder.createdVia || 'web'}</span>
                    </div>
                </div>
                <button class="btn-icon-sm" onclick="app.deleteReminder(${reminder.id}); event.stopPropagation();" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    renderPeople() {
        const container = document.getElementById('people-list');
        if (!container) return; // Element removed in v0.2.1
        container.innerHTML = this.people.map(p => `
            <div class="person-item ${this.currentView === 'person:' + p.id ? 'active' : ''}"
                 data-view="person:${p.id}" onclick="app.setView('person:${p.id}')">
                <i class="fas fa-user" style="opacity:0.5"></i>
                <span>${this.escapeHtml(p.name)}</span>
            </div>
        `).join('');
    }

    populateSelects() {
        // Project selects
        const projectOptions = `<option value="">No project</option>` +
            this.projects.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
        document.querySelectorAll('#task-project-input, #edit-project').forEach(s => {
            if (s) s.innerHTML = projectOptions;
        });

        // Label selects
        const labelOptions = `<option value="">No label</option>` +
            this.tags.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
        document.querySelectorAll('#task-label-input').forEach(s => {
            if (s) s.innerHTML = labelOptions;
        });

        // Assignee selects
        const assigneeOptions = `<option value="">Unassigned</option>` +
            this.people.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
        document.querySelectorAll('#task-assignee-input, #edit-assignee').forEach(s => {
            if (s) s.innerHTML = assigneeOptions;
        });
    }

    updateCounts() {
        const today = this.getTodayInTimezone();
        const pending = this.tasks.filter(t => t.status !== 'completed');
        
        const todayEl = document.getElementById('today-count');
        const remindersEl = document.getElementById('reminders-count');
        if (todayEl) todayEl.textContent = pending.filter(t => t.dueDate?.split('T')[0] === today).length || '';
        if (remindersEl) remindersEl.textContent = this.reminders.length || '';
    }

    // View Management
    setView(view) {
        this.currentView = view;
        
        // Clear filters when switching views
        if (!view.startsWith('upcoming')) {
            this.filters.projectId = null;
            this.filters.assigneeId = null;
            this.filters.labelId = null;
        }
        
        // Update nav active states
        document.querySelectorAll('.nav-item, .person-item, .nav-dropdown-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });
        
        // Handle upcoming dropdown toggle active state
        const upcomingToggle = document.querySelector('.nav-dropdown-toggle[data-view="upcoming"]');
        if (upcomingToggle) {
            upcomingToggle.classList.toggle('active', view === 'upcoming' || view.startsWith('upcoming:'));
        }

        const titles = { today: 'Today', upcoming: 'Upcoming', recurring: 'Recurring', completed: 'Completed', reminders: 'Reminders', links: 'Quick Links' };
        let title = titles[view];
        
        if (!title && view.startsWith('upcoming:')) {
            const projectId = parseInt(view.split(':')[1]);
            const project = this.projects.find(p => p.id === projectId);
            title = project ? `Upcoming - ${project.name}` : 'Upcoming';
        } else if (!title && view.startsWith('person:')) {
            const p = this.people.find(x => 'person:' + x.id === view);
            title = p?.name + "'s Tasks" || 'Person';
        }

        document.getElementById('view-title').textContent = title || 'Tasks';
        
        // Show/hide quick add based on view
        const quickAdd = document.getElementById('quick-add');
        const fab = document.getElementById('fab-add-task');
        if (quickAdd) {
            quickAdd.style.display = (view === 'reminders' || view === 'links') ? 'none' : '';
        }
        if (fab) {
            fab.style.display = (view === 'reminders' || view === 'links') ? 'none' : '';
        }
        
        // Show/hide upcoming-specific filters
        const filterMenu = document.getElementById('filter-menu');
        const isUpcomingView = view === 'upcoming' || view.startsWith('upcoming:');
        if (filterMenu) {
            filterMenu.classList.toggle('show-upcoming-filters', isUpcomingView);
        }
        
        if (view === 'reminders') {
            this.renderReminders();
        } else if (view === 'links') {
            this.renderLinks();
        } else {
            this.renderTasks();
        }
    }
    
    // Toggle upcoming dropdown expansion
    toggleUpcomingDropdown() {
        console.log('toggleUpcomingDropdown() called');
        console.log('Before toggle - upcomingDropdownExpanded:', this.upcomingDropdownExpanded);
        
        this.upcomingDropdownExpanded = !this.upcomingDropdownExpanded;
        const dropdown = document.getElementById('upcoming-dropdown');
        
        console.log('After toggle - upcomingDropdownExpanded:', this.upcomingDropdownExpanded);
        console.log('Dropdown element:', dropdown);
        
        if (dropdown) {
            dropdown.classList.toggle('expanded', this.upcomingDropdownExpanded);
            console.log('Dropdown classes after toggle:', dropdown.className);
        } else {
            console.error('Dropdown element not found!');
        }
    }
    
    // Render projects under Upcoming dropdown
    renderUpcomingProjects() {
        const container = document.getElementById('upcoming-projects-list');
        if (!container) return;
        
        container.innerHTML = this.projects.map(p => `
            <a href="#" class="nav-dropdown-item ${this.currentView === 'upcoming:' + p.id ? 'active' : ''}" 
               data-view="upcoming:${p.id}">
                <span class="color-dot" style="background:${p.color}"></span>
                <span>${this.escapeHtml(p.name)}</span>
            </a>
        `).join('');
        
        // Bind click events for project sub-items
        container.querySelectorAll('.nav-dropdown-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setView(el.dataset.view);
            });
        });
    }
    
    // Populate filter dropdowns
    populateFilterSelects() {
        // Project filter
        const projectSelect = document.getElementById('filter-project');
        if (projectSelect) {
            projectSelect.innerHTML = `<option value="">All Projects</option>` +
                this.projects.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
        }
        
        // Assignee filter
        const assigneeSelect = document.getElementById('filter-assignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = `<option value="">All Assignees</option>` +
                this.people.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
        }
        
        // Label filter
        const labelSelect = document.getElementById('filter-label');
        if (labelSelect) {
            labelSelect.innerHTML = `<option value="">All Labels</option>` +
                this.tags.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)}</option>`).join('');
        }
    }

    // Detail Panel (View Mode)
    async openDetailPanel(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.currentTask = task;
        this.renderViewMode();
        document.getElementById('detail-panel').classList.remove('hidden');
    }

    renderViewMode() {
        const task = this.currentTask;
        if (!task) return;

        // Title and checkbox
        document.getElementById('detail-title-display').textContent = task.title || 'Untitled';
        document.getElementById('detail-checkbox').className = `checkbox ${task.status === 'completed' ? 'checked' : ''} p${task.priority || 4}`;

        // Description
        const descEl = document.getElementById('detail-description-display');
        descEl.textContent = task.description || 'No description';
        descEl.style.opacity = task.description ? 1 : 0.5;

        // Info items
        document.getElementById('display-due-date').textContent = task.dueDate ? this.formatDate(task.dueDate) : 'No due date';
        
        const priorities = { 1: 'P1 - Urgent', 2: 'P2 - High', 3: 'P3 - Medium', 4: 'P4 - Low' };
        document.getElementById('display-priority').textContent = priorities[task.priority] || 'P4 - Low';
        
        const project = this.projects.find(p => p.id === task.projectId);
        document.getElementById('display-project').textContent = project?.name || 'No project';
        
        const assignee = this.people.find(p => p.id === task.assigneeId);
        document.getElementById('display-assignee').textContent = assignee?.name || 'Unassigned';
        
        document.getElementById('display-recurrence').textContent = task.recurrenceRule || 'No recurrence';
        
        // Notifications
        let notifyText = 'Notifications off';
        if (task.notifyEnabled) {
            notifyText = 'On due date';
            if (task.notifyDaysBefore > 0) {
                notifyText += `, ${task.notifyDaysBefore}d before at ${task.notifyTime || '10:00'}`;
            }
            if (task.notifyLate) {
                notifyText += ', daily if late';
            }
        }
        document.getElementById('display-notifications').textContent = notifyText;

        // Nudge button state
        const nudgeBtn = document.getElementById('nudge-task-btn');
        if (nudgeBtn) {
            nudgeBtn.disabled = !task.assigneeId;
            nudgeBtn.title = task.assigneeId 
                ? 'Send nudge notification to assignee' 
                : 'Assign someone to enable nudge';
        }

        // Load and display subtasks
        this.loadSubtasks(task.id).then(subtasks => {
            const container = document.getElementById('subtasks-display');
            if (subtasks.length === 0) {
                container.innerHTML = '<p style="opacity:0.5">No subtasks</p>';
            } else {
                container.innerHTML = subtasks.map(s => `
                    <div class="subtask-display ${s.completed ? 'completed' : ''}">
                        <i class="fas fa-${s.completed ? 'check-circle' : 'circle'}"></i>
                        <span>${this.escapeHtml(s.title)}</span>
                    </div>
                `).join('');
            }
        });

        // Display attachments
        this.renderAttachmentsDisplay(task.attachments || []);
    }

    // Render attachments in view mode
    renderAttachmentsDisplay(attachments) {
        const container = document.getElementById('attachments-display');
        if (!container) return;

        if (!attachments || attachments.length === 0) {
            container.innerHTML = '<p class="attachments-empty">No attachments</p>';
            return;
        }

        container.innerHTML = attachments.map((att, idx) => {
            const isImage = att.mimetype && att.mimetype.startsWith('image/');
            const url = att.signedUrl || att.url || att.path;
            const title = att.title || att.fileName || `Attachment ${idx + 1}`;
            
            if (isImage) {
                return `
                    <div class="attachment-item image" onclick="app.openLightbox('${url}')">
                        <img src="${url}" alt="${this.escapeHtml(title)}" loading="lazy">
                    </div>
                `;
            } else {
                const icon = this.getFileIcon(att.mimetype);
                return `
                    <a href="${url}" target="_blank" class="attachment-item file" download>
                        <i class="fas ${icon}"></i>
                        <span class="filename">${this.escapeHtml(title)}</span>
                    </a>
                `;
            }
        }).join('');
    }

    // Get icon for file type
    getFileIcon(mimetype) {
        if (!mimetype) return 'fa-file';
        if (mimetype.startsWith('image/')) return 'fa-file-image';
        if (mimetype.includes('pdf')) return 'fa-file-pdf';
        if (mimetype.includes('word') || mimetype.includes('doc')) return 'fa-file-word';
        if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'fa-file-excel';
        if (mimetype.includes('text')) return 'fa-file-lines';
        if (mimetype.includes('zip') || mimetype.includes('archive')) return 'fa-file-zipper';
        return 'fa-file';
    }

    // Open image lightbox
    openLightbox(url) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="close-lightbox" onclick="this.parentElement.remove()">&times;</button>
            <img src="${url}" alt="Full size">
        `;
        lightbox.onclick = (e) => {
            if (e.target === lightbox) lightbox.remove();
        };
        document.body.appendChild(lightbox);
    }

    // Upload attachments for current task
    async uploadAttachments() {
        if (!this.currentTask) return;
        
        const input = document.getElementById('edit-attachment-input');
        if (!input.files || input.files.length === 0) {
            this.toast('Please select files to upload', 'error');
            return;
        }

        const formData = new FormData();
        for (const file of input.files) {
            formData.append('files', file);
        }

        try {
            this.toast('Uploading...', 'info');
            const response = await fetch(`${API_URL}/tasks/${this.currentTask.id}/attachments`, {
                method: 'POST',
                body: formData
            });

            // Get response text first to handle non-JSON responses
            const responseText = await response.text();
            
            if (!response.ok) {
                console.error('Upload error response:', responseText);
                throw new Error(responseText || 'Upload failed');
            }
            
            // Parse JSON safely
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response:', responseText);
                throw new Error('Server returned invalid response');
            }
            
            this.toast(`Uploaded ${result.attachments?.length || 0} file(s)`, 'success');
            
            // Clear input
            input.value = '';
            
            // Refresh task data
            const updatedTask = await this.api(`/tasks/${this.currentTask.id}`);
            if (updatedTask) {
                // Update local task
                const idx = this.tasks.findIndex(t => t.id === this.currentTask.id);
                if (idx !== -1) this.tasks[idx] = updatedTask;
                this.currentTask = updatedTask;
                
                // Re-render attachments in edit modal
                this.renderEditAttachments(updatedTask.attachments || []);
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.toast('Failed to upload files', 'error');
        }
    }

    // Render attachments in edit modal
    renderEditAttachments(attachments) {
        const container = document.getElementById('edit-attachments-list');
        if (!container) return;
        
        if (!attachments || attachments.length === 0) {
            container.innerHTML = '<p class="attachments-empty">No attachments yet</p>';
            return;
        }
        
        container.innerHTML = attachments.map((att, idx) => {
            const isImage = att.mimetype?.startsWith('image/');
            const url = att.signedUrl || att.url || att.path;
            const title = att.title || att.fileName || `Attachment ${idx + 1}`;
            
            if (isImage) {
                return `<div class="attachment-item image">
                    <img src="${url}" alt="${this.escapeHtml(title)}" onclick="app.openLightbox('${url}')">
                </div>`;
            }
            return `<a href="${url}" target="_blank" class="attachment-item file" download>
                <i class="fas ${this.getFileIcon(att.mimetype)}"></i>
                <span class="filename">${this.escapeHtml(title)}</span>
            </a>`;
        }).join('');
    }

    closeDetailPanel() {
        document.getElementById('detail-panel').classList.add('hidden');
        this.currentTask = null;
    }

    // Edit Modal
    async openEditModal() {
        if (!this.currentTask) return;
        const task = this.currentTask;

        document.getElementById('edit-title').value = task.title || '';
        document.getElementById('edit-description').value = task.description || '';
        
        if (task.dueDate) {
            const [datePart, timePart] = task.dueDate.split('T');
            document.getElementById('edit-due-date').value = datePart || '';
            document.getElementById('edit-due-time').value = timePart ? timePart.substring(0, 5) : '';
        } else {
            document.getElementById('edit-due-date').value = '';
            document.getElementById('edit-due-time').value = '';
        }

        document.getElementById('edit-priority').value = task.priority || 4;
        document.getElementById('edit-project').value = task.projectId || '';
        document.getElementById('edit-assignee').value = task.assigneeId || '';
        document.getElementById('edit-recurrence').value = task.recurrenceRule || '';

        // Notifications
        document.getElementById('edit-notify-enabled').checked = task.notifyEnabled || false;
        document.getElementById('edit-notify-advance').checked = (task.notifyDaysBefore || 0) > 0;
        document.getElementById('edit-notify-days').value = task.notifyDaysBefore || 1;
        document.getElementById('edit-notify-time').value = task.notifyTime || '10:00';
        document.getElementById('edit-notify-late').checked = task.notifyLate || false;
        this.toggleEditNotifyOptions();

        // Tags
        this.renderEditTags(task.tagIds || []);

        // Subtasks
        const subtasks = await this.loadSubtasks(task.id);
        this.renderEditSubtasks(subtasks);

        // Attachments
        this.renderEditAttachments(task.attachments || []);

        document.getElementById('edit-task-modal').classList.remove('hidden');
    }

    closeEditModal() {
        document.getElementById('edit-task-modal').classList.add('hidden');
    }

    async sendReminder() {
        if (!this.currentTask) return;
        
        const btn = document.getElementById('send-reminder-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`/api/tasks/${this.currentTask.id}/remind`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to send reminder');
            
            btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('Failed to send reminder:', error);
            btn.innerHTML = '<i class="fas fa-times"></i> Failed';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 2000);
        }
    }

    async sendNudge() {
        if (!this.currentTask) return;
        if (!this.currentTask.assigneeId) {
            this.toast('Task has no assignee to nudge', 'error');
            return;
        }
        
        const btn = document.getElementById('nudge-task-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`/api/tasks/${this.currentTask.id}/nudge`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to send nudge');
            }
            
            btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
            this.toast('Nudge sent!', 'success');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = !this.currentTask?.assigneeId;
            }, 2000);
        } catch (error) {
            console.error('Failed to send nudge:', error);
            btn.innerHTML = '<i class="fas fa-times"></i> Failed';
            this.toast(error.message, 'error');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = !this.currentTask?.assigneeId;
            }, 2000);
        }
    }

    renderEditTags(selectedIds) {
        const container = document.getElementById('edit-tags');
        container.innerHTML = this.tags.map(t => `
            <div class="tag-chip ${selectedIds.includes(t.id) ? 'selected' : ''}" 
                 style="background:${t.color}20; color:${t.color}"
                 data-id="${t.id}"
                 onclick="this.classList.toggle('selected')">
                ${this.escapeHtml(t.name)}
            </div>
        `).join('') || '<span style="opacity:0.5">No labels available</span>';
    }

    renderEditSubtasks(subtasks) {
        const container = document.getElementById('edit-subtasks-list');
        container.innerHTML = subtasks.map(s => `
            <div class="edit-subtask-item" data-id="${s.id}">
                <input type="checkbox" ${s.completed ? 'checked' : ''} 
                       onchange="app.toggleSubtask(${s.id}, this.checked)">
                <span>${this.escapeHtml(s.title)}</span>
                <button class="btn-icon-sm" onclick="app.deleteSubtask(${s.id}); this.parentElement.remove();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    toggleEditNotifyOptions() {
        const enabled = document.getElementById('edit-notify-enabled')?.checked;
        const subOptions = document.getElementById('edit-notify-sub-options');
        if (subOptions) subOptions.style.display = enabled ? 'block' : 'none';
    }

    async saveEditedTask() {
        if (!this.currentTask) return;

        // Combine date and time
        let dueDate = document.getElementById('edit-due-date').value || null;
        const dueTime = document.getElementById('edit-due-time').value;
        if (dueDate && dueTime) {
            dueDate = `${dueDate}T${dueTime}:00`;
        }

        // Get selected tags
        const tagIds = Array.from(document.querySelectorAll('#edit-tags .tag-chip.selected'))
            .map(el => parseInt(el.dataset.id));

        const data = {
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value,
            dueDate,
            priority: parseInt(document.getElementById('edit-priority').value),
            projectId: document.getElementById('edit-project').value || null,
            assigneeId: document.getElementById('edit-assignee').value || null,
            recurrenceRule: document.getElementById('edit-recurrence').value || null,
            tagIds,
            notifyEnabled: document.getElementById('edit-notify-enabled').checked,
            notifyDaysBefore: document.getElementById('edit-notify-advance').checked ? 
                (parseInt(document.getElementById('edit-notify-days').value) || 1) : 0,
            notifyTime: document.getElementById('edit-notify-time').value || '10:00',
            notifyLate: document.getElementById('edit-notify-late').checked
        };

        await this.updateTask(this.currentTask.id, data);
        this.currentTask = { ...this.currentTask, ...data };
        this.renderViewMode();
        this.closeEditModal();
        this.toast('Task updated', 'success');
    }

    // Task Form
    showTaskForm() {
        document.getElementById('quick-add').classList.add('hidden');
        document.getElementById('task-form-container').classList.remove('hidden');
        document.getElementById('task-title-input').focus();
    }

    hideTaskForm() {
        document.getElementById('quick-add').classList.remove('hidden');
        document.getElementById('task-form-container').classList.add('hidden');
        document.getElementById('task-form').reset();
    }

    toggleNotifyOptions() {
        const enabled = document.getElementById('notify-enabled')?.checked;
        const subOptions = document.getElementById('notify-sub-options');
        if (subOptions) subOptions.classList.toggle('hidden', !enabled);
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('task-title-input').value.trim();
        if (!title) return;

        // Combine date and time
        let dueDate = document.getElementById('task-due-input').value || null;
        const dueTime = document.getElementById('task-due-time-input')?.value;
        if (dueDate && dueTime) {
            dueDate = `${dueDate}T${dueTime}:00`;
        }

        // Notification settings
        const notifyEnabled = document.getElementById('notify-enabled')?.checked || false;
        const notifyAdvance = document.getElementById('notify-advance-enabled')?.checked || false;
        const notifyDaysBefore = notifyAdvance ? (parseInt(document.getElementById('notify-days-before').value) || 1) : 0;
        const notifyTime = document.getElementById('notify-time')?.value || this.defaultRemindTime;
        const notifyLate = document.getElementById('notify-late-enabled')?.checked || false;

        const data = {
            title,
            description: document.getElementById('task-desc-input').value,
            dueDate,
            priority: parseInt(document.getElementById('task-priority-input').value),
            projectId: document.getElementById('task-project-input').value || null,
            labelId: document.getElementById('task-label-input').value || null,
            recurrenceRule: document.getElementById('task-recurrence-input').value || null,
            recurrenceBase: document.getElementById('task-recurrence-base-input').value,
            assigneeId: document.getElementById('task-assignee-input').value || null,
            notifyEnabled,
            notifyDaysBefore,
            notifyTime,
            notifyLate
        };

        // Auto-set today if in today view
        if (this.currentView === 'today' && !data.dueDate) {
            data.dueDate = this.getTodayInTimezone();
        }

        await this.createTask(data);
        this.hideTaskForm();
    }

    // Quick Add Project/Label
    showQuickAddModal(type) {
        this.quickAddType = type;
        document.getElementById('quick-add-title').textContent = type === 'project' ? 'New Project' : 'New Label';
        document.getElementById('quick-add-name').value = '';
        document.getElementById('quick-add-modal').classList.remove('hidden');
        document.getElementById('quick-add-name').focus();
    }

    closeQuickAddModal() {
        document.getElementById('quick-add-modal').classList.add('hidden');
    }

    async saveQuickAdd() {
        const name = document.getElementById('quick-add-name').value.trim();
        if (!name) return this.toast('Name is required', 'error');

        const data = { name, color: this.quickAddColor };
        
        if (this.quickAddType === 'project') {
            const result = await this.createProject(data);
            if (result) {
                document.getElementById('task-project-input').value = result.id;
            }
        } else {
            const result = await this.createTag(data);
            if (result) {
                document.getElementById('task-label-input').value = result.id;
            }
        }

        this.closeQuickAddModal();
    }

    // Settings
    showSettings() {
        document.getElementById('settings-timezone').value = this.timezone;
        document.getElementById('settings-default-remind-time').value = this.defaultRemindTime;
        document.getElementById('settings-discord-channel').value = this.discordChannel;
        this.renderSettingsLists();
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    renderSettingsLists() {
        // Projects
        const projectsContainer = document.getElementById('settings-projects-list');
        projectsContainer.innerHTML = this.projects.map(p => `
            <div class="settings-item">
                <span class="color-dot" style="background:${p.color}"></span>
                <span>${this.escapeHtml(p.name)}</span>
                <button class="btn-icon-sm" onclick="app.deleteProject(${p.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('') || '<p style="opacity:0.5">No projects</p>';

        // Labels
        const labelsContainer = document.getElementById('settings-labels-list');
        labelsContainer.innerHTML = this.tags.map(t => `
            <div class="settings-item">
                <span class="color-dot" style="background:${t.color}"></span>
                <span>${this.escapeHtml(t.name)}</span>
                <button class="btn-icon-sm" onclick="app.deleteTag(${t.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('') || '<p style="opacity:0.5">No labels</p>';

        // Assignees
        const assigneesContainer = document.getElementById('settings-assignees-list');
        assigneesContainer.innerHTML = this.people.map(p => `
            <div class="settings-item">
                <i class="fas fa-user"></i>
                <span>${this.escapeHtml(p.name)}</span>
                <span class="discord-id" style="opacity:0.5; font-size:12px">${p.discordId}</span>
            </div>
        `).join('');
    }

    async addProjectFromSettings() {
        const name = document.getElementById('settings-new-project').value.trim();
        const color = document.getElementById('settings-project-color').value;
        if (!name) return;

        await this.createProject({ name, color });
        document.getElementById('settings-new-project').value = '';
        this.renderSettingsLists();
    }

    async addLabelFromSettings() {
        const name = document.getElementById('settings-new-label').value.trim();
        const color = document.getElementById('settings-label-color').value;
        if (!name) return;

        await this.createTag({ name, color });
        document.getElementById('settings-new-label').value = '';
        this.renderSettingsLists();
    }

    saveSettings() {
        this.timezone = document.getElementById('settings-timezone').value;
        this.defaultRemindTime = document.getElementById('settings-default-remind-time').value;
        this.discordChannel = document.getElementById('settings-discord-channel').value;
        
        localStorage.setItem('gandash_timezone', this.timezone);
        localStorage.setItem('gandash_remind_time', this.defaultRemindTime);
        localStorage.setItem('gandash_discord_channel', this.discordChannel);
        
        // Sync to backend
        this.api('/settings', {
            method: 'POST',
            body: {
                timezone: this.timezone,
                defaultRemindTime: this.defaultRemindTime,
                discordChannelId: this.discordChannel
            }
        }).catch(() => {});
        
        this.closeSettings();
        this.renderTasks();
        this.toast('Settings saved', 'success');
    }

    // Event Binding
    bindEvents() {
        // Version badge click for hard refresh
        document.getElementById('version-badge')?.addEventListener('click', () => {
            if (confirm('Force reload GanDash? This will clear the cache and refresh the page.')) {
                // Clear service worker cache if exists
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                        for (let registration of registrations) {
                            registration.unregister();
                        }
                    });
                }
                // Clear cache and reload
                window.location.reload(true);
            }
        });
        
        // Navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(el => {
            el.addEventListener('click', (e) => {
                console.log('Nav item clicked:', el.className, el.dataset.view);
                
                // Special handling for upcoming dropdown toggle
                if (el.classList.contains('nav-dropdown-toggle')) {
                    console.log('Dropdown toggle detected!');
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleUpcomingDropdown();
                    // Set view to upcoming (general) when clicking toggle
                    if (!this.currentView.startsWith('upcoming')) {
                        this.setView('upcoming');
                    }
                } else {
                    this.setView(el.dataset.view);
                }
            });
        });
        
        // Alternative: Add direct click handler to upcoming dropdown div
        const upcomingDropdownDiv = document.getElementById('upcoming-dropdown');
        if (upcomingDropdownDiv) {
            // Click on the dropdown container itself
            upcomingDropdownDiv.addEventListener('click', (e) => {
                // Only toggle if clicking on the parent div or the toggle link itself
                if (e.target.closest('.nav-dropdown-toggle') || e.target === upcomingDropdownDiv) {
                    console.log('Upcoming dropdown div clicked');
                    this.toggleUpcomingDropdown();
                }
            });
        }

        // Task form
        document.getElementById('quick-add-btn')?.addEventListener('click', () => this.showTaskForm());
        document.getElementById('cancel-task-btn')?.addEventListener('click', () => this.hideTaskForm());
        document.getElementById('task-form')?.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        
        // Floating Action Button
        document.getElementById('fab-add-task')?.addEventListener('click', () => this.showTaskForm());
        
        // Sort dropdown
        document.getElementById('sort-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('sort-menu');
        });
        document.querySelectorAll('#sort-menu .dropdown-item').forEach(item => {
            item.addEventListener('click', () => this.setSort(item.dataset.sort));
        });
        
        // Filter dropdown
        document.getElementById('filter-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('filter-menu');
        });
        document.getElementById('filter-show-completed')?.addEventListener('change', (e) => {
            this.toggleFilter('showCompleted', e.target.checked);
        });
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            document.getElementById(`filter-${p}`)?.addEventListener('change', (e) => {
                this.toggleFilter(p, e.target.checked);
            });
        });
        
        // Filter select dropdowns (Project, Assignee, Label)
        document.getElementById('filter-project')?.addEventListener('change', (e) => {
            this.filters.projectId = e.target.value ? parseInt(e.target.value) : null;
            this.renderTasks();
        });
        document.getElementById('filter-assignee')?.addEventListener('change', (e) => {
            this.filters.assigneeId = e.target.value ? parseInt(e.target.value) : null;
            this.renderTasks();
        });
        document.getElementById('filter-label')?.addEventListener('change', (e) => {
            this.filters.labelId = e.target.value ? parseInt(e.target.value) : null;
            this.renderTasks();
        });
        
        // View toggle (Kanban/List)
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.displayMode;
                this.setDisplayMode(mode);
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => this.closeDropdowns());
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.addEventListener('click', e => e.stopPropagation());
        });
        
        // Initialize filter UI
        this.initFilterUI();

        // Notification toggle
        document.getElementById('notify-enabled')?.addEventListener('change', () => this.toggleNotifyOptions());

        // Inline add project/label
        document.getElementById('inline-add-project')?.addEventListener('click', () => this.showQuickAddModal('project'));
        document.getElementById('inline-add-label')?.addEventListener('click', () => this.showQuickAddModal('label'));

        // Quick add modal
        document.querySelectorAll('.close-quick-add-btn').forEach(el => el.addEventListener('click', () => this.closeQuickAddModal()));
        document.getElementById('save-quick-add-btn')?.addEventListener('click', () => this.saveQuickAdd());
        document.querySelectorAll('#quick-add-color-picker .color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#quick-add-color-picker .color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.quickAddColor = btn.dataset.color;
            });
        });

        // Detail panel
        document.getElementById('close-detail-btn')?.addEventListener('click', () => this.closeDetailPanel());
        document.getElementById('edit-task-btn')?.addEventListener('click', () => this.openEditModal());
        document.getElementById('delete-task-btn')?.addEventListener('click', () => {
            if (this.currentTask && confirm('Delete this task?')) this.deleteTask(this.currentTask.id);
        });
        document.getElementById('nudge-task-btn')?.addEventListener('click', () => this.sendNudge());
        document.getElementById('detail-checkbox')?.addEventListener('click', () => {
            if (this.currentTask) this.promptCompleteTask(this.currentTask.id);
        });

        // Edit modal
        document.querySelectorAll('.close-edit-modal-btn').forEach(el => el.addEventListener('click', () => this.closeEditModal()));
        document.getElementById('save-edit-btn')?.addEventListener('click', () => this.saveEditedTask());
        document.getElementById('send-reminder-btn')?.addEventListener('click', () => this.sendReminder());
        document.getElementById('edit-notify-enabled')?.addEventListener('change', () => this.toggleEditNotifyOptions());
        
        // Edit attachments
        document.getElementById('edit-upload-attachment-btn')?.addEventListener('click', () => this.uploadAttachments());

        // Edit subtasks
        document.getElementById('edit-add-subtask-btn')?.addEventListener('click', async () => {
            const input = document.getElementById('edit-new-subtask');
            const title = input.value.trim();
            if (!title || !this.currentTask) return;
            
            await this.createSubtask(this.currentTask.id, title);
            input.value = '';
            const subtasks = await this.loadSubtasks(this.currentTask.id);
            this.renderEditSubtasks(subtasks);
        });

        // Confirm complete modal
        document.querySelectorAll('.close-confirm-btn').forEach(el => el.addEventListener('click', () => this.closeConfirmModal()));
        document.getElementById('confirm-complete-btn')?.addEventListener('click', () => this.confirmCompleteTask());

        // Settings
        document.getElementById('settings-btn')?.addEventListener('click', () => this.showSettings());
        document.querySelectorAll('.close-settings-btn').forEach(el => el.addEventListener('click', () => this.closeSettings()));
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('settings-add-project')?.addEventListener('click', () => this.addProjectFromSettings());
        document.getElementById('settings-add-label')?.addEventListener('click', () => this.addLabelFromSettings());

        // Search
        document.getElementById('search-input')?.addEventListener('input', () => this.renderTasks());

        // Mobile menu
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });
        
        // Mobile overlay click to close menu
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeMobileMenu();
        });
        
        // Close mobile menu when selecting a nav item
        document.querySelectorAll('.sidebar .nav-item, .sidebar .person-item').forEach(el => {
            el.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea')) {
                if (e.key === 'Escape') {
                    this.hideTaskForm();
                    this.closeEditModal();
                    this.closeQuickAddModal();
                }
                return;
            }
            if (e.key === 'n') this.showTaskForm();
            if (e.key === 'Escape') {
                this.closeDetailPanel();
                this.closeSettings();
                this.closeConfirmModal();
            }
        });
    }

    // Utilities
    showLoading(show) {
        document.getElementById('loading')?.classList.toggle('hidden', !show);
        document.getElementById('tasks-list')?.classList.toggle('hidden', show);
    }

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    getTodayInTimezone() {
        return new Date().toLocaleDateString('en-CA', { timeZone: this.timezone });
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const d = date.toISOString().split('T')[0];
        const t = today.toISOString().split('T')[0];
        const tm = tomorrow.toISOString().split('T')[0];

        const hasTime = dateStr.includes('T') && !dateStr.endsWith('T00:00:00');
        const timeStr = hasTime ? date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: this.timezone 
        }) : '';

        let dateLabel;
        if (d === t) dateLabel = 'Today';
        else if (d === tm) dateLabel = 'Tomorrow';
        else dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: this.timezone });

        return timeStr ? `${dateLabel} ${timeStr}` : dateLabel;
    }

    getDueClass(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr).toISOString().split('T')[0];
        const t = new Date().toISOString().split('T')[0];
        if (d < t) return 'overdue';
        if (d === t) return 'today';
        return '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
const app = new Dash();
