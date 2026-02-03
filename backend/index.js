// GanDash Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

// Multer setup for file uploads
const upload = multer({ 
    dest: '/tmp/dash-uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Akubot status file path
const AKUBOT_STATUS_FILE = '/tmp/akubot-status.json';

const nocodb = require('./services/nocodb');
const discord = require('./services/discord');
const notificationCron = require('./cron/notifications');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// ==================== AKUBOT STATUS ====================
app.get('/api/akubot/status', (req, res) => {
    try {
        if (!fs.existsSync(AKUBOT_STATUS_FILE)) {
            return res.json({ status: 'idle' });
        }
        
        const stats = fs.statSync(AKUBOT_STATUS_FILE);
        const ageMs = Date.now() - stats.mtimeMs;
        
        // If file is older than 60 seconds, consider it stale (AI is idle)
        if (ageMs > 60000) {
            return res.json({ status: 'idle', stale: true });
        }
        
        const data = JSON.parse(fs.readFileSync(AKUBOT_STATUS_FILE, 'utf8'));
        res.json(data);
    } catch (error) {
        // On any error, default to idle
        res.json({ status: 'idle', error: error.message });
    }
});

// ==================== TASKS ====================
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await nocodb.getRecords('tasks');
        // Map NocoDB fields to frontend format
        const tasks = (result.list || []).map(t => ({
            id: t.Id,
            title: t.Title || '',
            description: t.Description || '',
            status: t.Status || 'pending',
            priority: t.Priority || 4,
            dueDate: t['Due Date'] || null,
            dueTime: t['Due Time'] || null,
            projectId: t['Project ID'] || null,
            completedAt: t['Completed At'] || null,
            createdAt: t['Created At'] || t.CreatedAt,
            recurrenceRule: t['Recurrence Rule'] || null,
            recurrenceBase: t['Recurrence Base'] || 'due_date',
            assigneeId: t['Assignee ID'] || null,
            notifyEnabled: t['Notify Enabled'] === true || t['Notify Enabled'] === 'true' || t['Notify Enabled'] === 1,
            notifyDaysBefore: t['Notify Days Before'] || 0,
            notifyTime: t['Notify Time'] || '10:00',
            notifyLate: t['Notify Late'] === true || t['Notify Late'] === 'true' || t['Notify Late'] === 1,
            attachments: t.Attachments || []
        }));
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASK ATTACHMENTS ====================
// Upload attachment to a task
app.post('/api/tasks/:id/attachments', upload.array('files', 10), async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const uploadedAttachments = [];
        
        for (const file of req.files) {
            // Upload to NocoDB storage
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path), {
                filename: file.originalname,
                contentType: file.mimetype
            });
            
            console.log(`[API] Uploading file ${file.originalname} to NocoDB...`);
            
            const uploadResponse = await axios.post(
                `${process.env.NOCODB_URL}/api/v2/storage/upload`,
                formData,
                {
                    headers: {
                        'xc-token': process.env.NOCODB_TOKEN,
                        ...formData.getHeaders()
                    }
                }
            );
            
            console.log(`[API] NocoDB upload response:`, JSON.stringify(uploadResponse.data));
            
            // Clean up temp file
            fs.unlinkSync(file.path);
            
            if (uploadResponse.data && uploadResponse.data.length > 0) {
                uploadedAttachments.push(uploadResponse.data[0]);
            } else if (uploadResponse.data) {
                // Handle case where response is object not array
                uploadedAttachments.push(uploadResponse.data);
            }
        }
        
        // Get current attachments
        const task = await nocodb.getRecord('tasks', taskId);
        const existingAttachments = task.Attachments || [];
        
        // Merge with new attachments
        const allAttachments = [...existingAttachments, ...uploadedAttachments];
        
        // Update task with new attachments array
        await nocodb.updateRecord('tasks', taskId, {
            'Attachments': allAttachments
        });
        
        console.log(`[API] Uploaded ${uploadedAttachments.length} attachment(s) to task ${taskId}`);
        res.json({ success: true, attachments: uploadedAttachments });
    } catch (error) {
        console.error('[API] Attachment upload error:', error.message);
        console.error('[API] Full error:', error.response?.data || error);
        // Clean up any temp files on error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (e) {}
            });
        }
        // Always return JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

// Get attachments for a task
app.get('/api/tasks/:id/attachments', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await nocodb.getRecord('tasks', taskId);
        res.json(task.Attachments || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a specific attachment from a task
app.delete('/api/tasks/:id/attachments/:index', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const attachmentIndex = parseInt(req.params.index);
        
        const task = await nocodb.getRecord('tasks', taskId);
        const attachments = task.Attachments || [];
        
        if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        
        attachments.splice(attachmentIndex, 1);
        
        await nocodb.updateRecord('tasks', taskId, {
            'Attachments': attachments
        });
        
        console.log(`[API] Deleted attachment ${attachmentIndex} from task ${taskId}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const data = {
            'Title': req.body.title,
            'Description': req.body.description || null,
            'Status': req.body.status || 'pending',
            'Priority': req.body.priority || 4,
            'Due Date': req.body.dueDate || null,
            'Project ID': req.body.projectId || null,
            'Assignee ID': req.body.assigneeId || null,
            'Created At': new Date().toISOString(),
            'Recurrence Rule': req.body.recurrenceRule || null,
            'Recurrence Base': req.body.recurrenceBase || 'due_date',
            'Notify Enabled': req.body.notifyEnabled || false,
            'Notify Days Before': req.body.notifyDaysBefore || 0,
            'Notify Time': req.body.notifyTime || '10:00',
            'Notify Late': req.body.notifyLate || false
        };
        const result = await nocodb.createRecord('tasks', data);
        res.json({ id: result.Id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        
        // Get current task state before update
        const currentTask = await nocodb.getRecord('tasks', taskId);
        
        const data = {};
        if (req.body.title !== undefined) data['Title'] = req.body.title;
        if (req.body.description !== undefined) data['Description'] = req.body.description;
        if (req.body.status !== undefined) data['Status'] = req.body.status;
        if (req.body.priority !== undefined) data['Priority'] = req.body.priority;
        if (req.body.dueDate !== undefined) data['Due Date'] = req.body.dueDate;
        if (req.body.dueTime !== undefined) data['Due Time'] = req.body.dueTime;
        if (req.body.projectId !== undefined) data['Project ID'] = req.body.projectId;
        if (req.body.completedAt !== undefined) data['Completed At'] = req.body.completedAt;
        if (req.body.recurrenceRule !== undefined) data['Recurrence Rule'] = req.body.recurrenceRule;
        if (req.body.recurrenceBase !== undefined) data['Recurrence Base'] = req.body.recurrenceBase;
        if (req.body.assigneeId !== undefined) data['Assignee ID'] = req.body.assigneeId;
        if (req.body.notifyEnabled !== undefined) data['Notify Enabled'] = req.body.notifyEnabled;
        if (req.body.notifyDaysBefore !== undefined) data['Notify Days Before'] = req.body.notifyDaysBefore;
        if (req.body.notifyTime !== undefined) data['Notify Time'] = req.body.notifyTime;
        if (req.body.notifyLate !== undefined) data['Notify Late'] = req.body.notifyLate;
        
        // Check if task is being marked as done/completed
        const isBeingCompleted = (req.body.status === 'done' || req.body.status === 'completed') &&
                                  currentTask.Status !== 'done' && currentTask.Status !== 'completed';
        
        if (isBeingCompleted) {
            data['Completed At'] = new Date().toISOString();
            
            // Schedule deletion in 7 days if there's a notification message
            if (currentTask['NotificationMessageId']) {
                const deleteAt = new Date();
                deleteAt.setDate(deleteAt.getDate() + 7);
                data['ScheduledDeleteAt'] = deleteAt.toISOString();
            }
        }
        
        await nocodb.updateRecord('tasks', taskId, data);
        
        // If marked complete, send Discord notification
        if (isBeingCompleted) {
            try {
                // Get assignee for mention
                const ASSIGNEES = {
                    1: { name: 'Brendon', discordId: '147649565330243584' },
                    2: { name: 'Ivy', discordId: '623156654199930882' }
                };
                const assignee = currentTask['Assignee ID'] ? ASSIGNEES[currentTask['Assignee ID']] : null;
                
                // If there's an existing notification, edit it
                if (currentTask['NotificationMessageId']) {
                    const completedEmbed = discord.buildTaskEmbed(currentTask, 'completed');
                    completedEmbed.description = 'Completed via Dash web UI ✨';
                    await discord.editMessageEmbed(currentTask['NotificationMessageId'], completedEmbed);
                    console.log(`[API] Updated Discord notification for completed task ${taskId}`);
                } else {
                    // Send a new completion notification
                    const completedEmbed = {
                        title: `✅ Task Completed`,
                        description: `**${currentTask.Title}**`,
                        color: 0x2ECC71, // Green
                        fields: [],
                        footer: { text: 'Completed via Dash web UI' },
                        timestamp: new Date().toISOString()
                    };
                    
                    if (currentTask.Description) {
                        completedEmbed.fields.push({
                            name: '📝 Description',
                            value: currentTask.Description.substring(0, 100) + (currentTask.Description.length > 100 ? '...' : ''),
                            inline: false
                        });
                    }
                    
                    await discord.sendEmbedNotification(completedEmbed, assignee?.discordId);
                    console.log(`[API] Sent completion notification for task "${currentTask.Title}"`);
                }
            } catch (discordErr) {
                console.error('[API] Failed to send Discord notification:', discordErr.message);
            }
        }
        
        // Handle recurring task completion
        if ((req.body.status === 'completed' || req.body.status === 'done') && req.body.recurrenceRule) {
            await handleRecurringTaskCompletion(taskId, req.body);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await nocodb.deleteRecord('tasks', parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SUBTASKS ====================
app.get('/api/tasks/:taskId/subtasks', async (req, res) => {
    try {
        const result = await nocodb.getRecords('subtasks');
        const subtasks = (result.list || [])
            .filter(s => s['Parent Task ID'] === parseInt(req.params.taskId))
            .map(s => ({
                id: s.Id,
                parentTaskId: s['Parent Task ID'],
                title: s.Title,
                completed: s.Completed === true || s.Completed === 'true'
            }));
        res.json(subtasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/subtasks', async (req, res) => {
    try {
        const data = {
            'Parent Task ID': parseInt(req.params.taskId),
            'Title': req.body.title,
            'Completed': false
        };
        const result = await nocodb.createRecord('subtasks', data);
        res.json({ id: result.Id, ...req.body, completed: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/subtasks/:id', async (req, res) => {
    try {
        const data = {};
        if (req.body.title !== undefined) data['Title'] = req.body.title;
        if (req.body.completed !== undefined) data['Completed'] = req.body.completed;
        await nocodb.updateRecord('subtasks', parseInt(req.params.id), data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/subtasks/:id', async (req, res) => {
    try {
        await nocodb.deleteRecord('subtasks', parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== PROJECTS ====================
app.get('/api/projects', async (req, res) => {
    try {
        const result = await nocodb.getRecords('projects');
        const projects = (result.list || []).map(p => ({
            id: p.Id,
            name: p.Name || '',
            color: p.Color || '#757575',
            icon: p.Icon || null
        }));
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const data = {
            'Name': req.body.name,
            'Color': req.body.color || '#757575',
            'Icon': req.body.icon || null
        };
        const result = await nocodb.createRecord('projects', data);
        res.json({ id: result.Id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await nocodb.deleteRecord('projects', parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TAGS ====================
app.get('/api/tags', async (req, res) => {
    try {
        const result = await nocodb.getRecords('tags');
        const tags = (result.list || []).map(t => ({
            id: t.Id,
            name: t.Name || '',
            color: t.Color || '#757575'
        }));
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tags', async (req, res) => {
    try {
        const data = {
            'Name': req.body.name,
            'Color': req.body.color || '#757575'
        };
        const result = await nocodb.createRecord('tags', data);
        res.json({ id: result.Id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== PEOPLE (Assignees) ====================
app.get('/api/people', async (req, res) => {
    try {
        const result = await nocodb.getRecords('people');
        const people = (result.list || []).map(p => ({
            id: p.Id,
            name: p.Name || '',
            discordId: p['Discord ID'] || null
        }));
        res.json(people);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASK ASSIGNEES ====================
app.get('/api/tasks/:taskId/assignees', async (req, res) => {
    try {
        const result = await nocodb.getRecords('task_assignees');
        const assignees = (result.list || [])
            .filter(a => a['Task ID'] === parseInt(req.params.taskId))
            .map(a => a['Person ID']);
        res.json(assignees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/assignees', async (req, res) => {
    try {
        const data = {
            'Task ID': parseInt(req.params.taskId),
            'Person ID': req.body.personId
        };
        await nocodb.createRecord('task_assignees', data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASK TAGS ====================
app.get('/api/tasks/:taskId/tags', async (req, res) => {
    try {
        const result = await nocodb.getRecords('task_tags');
        const tags = (result.list || [])
            .filter(t => t['Task ID'] === parseInt(req.params.taskId))
            .map(t => t['Tag ID']);
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/tags', async (req, res) => {
    try {
        const data = {
            'Task ID': parseInt(req.params.taskId),
            'Tag ID': req.body.tagId
        };
        await nocodb.createRecord('task_tags', data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== NOTIFICATION SETTINGS ====================
app.get('/api/tasks/:taskId/notifications', async (req, res) => {
    try {
        const result = await nocodb.getRecords('notification_settings');
        const settings = (result.list || [])
            .filter(n => n['Task ID'] === parseInt(req.params.taskId))
            .map(n => ({
                id: n.Id,
                taskId: n['Task ID'],
                notifyOnDue: n['Notify On Due'] === true || n['Notify On Due'] === 'true',
                notifyDaysBefore: n['Notify Days Before'] || 0
            }));
        res.json(settings[0] || { notifyOnDue: true, notifyDaysBefore: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/notifications', async (req, res) => {
    try {
        const data = {
            'Task ID': parseInt(req.params.taskId),
            'Notify On Due': req.body.notifyOnDue !== false,
            'Notify Days Before': req.body.notifyDaysBefore || 0
        };
        const result = await nocodb.createRecord('notification_settings', data);
        res.json({ id: result.Id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== RECURRING TASK HANDLING ====================
async function handleRecurringTaskCompletion(taskId, taskData) {
    if (!taskData.recurrenceRule) return;
    
    try {
        // Get the original task
        const task = await nocodb.getRecord('tasks', taskId);
        
        // Calculate next due date
        const baseDate = taskData.recurrenceBase === 'completion_date' 
            ? new Date() 
            : new Date(task['Due Date'] || Date.now());
        
        const nextDue = calculateNextDueDate(baseDate, taskData.recurrenceRule);
        
        if (nextDue) {
            // Create new task instance
            const newTaskData = {
                'Title': task.Title,
                'Description': task.Description,
                'Status': 'pending',
                'Priority': task.Priority,
                'Due Date': nextDue.toISOString(),
                'Project ID': task['Project ID'],
                'Created At': new Date().toISOString(),
                'Recurrence Rule': task['Recurrence Rule'],
                'Recurrence Base': task['Recurrence Base']
            };
            await nocodb.createRecord('tasks', newTaskData);
            console.log(`[Recurring] Created next instance for task ${taskId}`);
        }
    } catch (error) {
        console.error('[Recurring] Error handling completion:', error.message);
    }
}

function calculateNextDueDate(baseDate, rule) {
    const next = new Date(baseDate);
    
    switch (rule.toLowerCase()) {
        case 'daily':
            next.setDate(next.getDate() + 1);
            break;
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'biweekly':
            next.setDate(next.getDate() + 14);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'quarterly':
            next.setMonth(next.getMonth() + 3);
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
        default:
            // Custom format: "every X days/weeks/months"
            const match = rule.match(/every\s+(\d+)\s+(day|week|month|year)s?/i);
            if (match) {
                const [, num, unit] = match;
                const n = parseInt(num);
                switch (unit.toLowerCase()) {
                    case 'day': next.setDate(next.getDate() + n); break;
                    case 'week': next.setDate(next.getDate() + n * 7); break;
                    case 'month': next.setMonth(next.getMonth() + n); break;
                    case 'year': next.setFullYear(next.getFullYear() + n); break;
                }
            } else {
                return null;
            }
    }
    
    return next;
}

// ==================== REMINDERS ====================
app.get('/api/reminders', async (req, res) => {
    try {
        const result = await nocodb.getRecords('reminders');
        const reminders = (result.list || [])
            .filter(r => !r.Archived) // Only show non-archived
            .map(r => ({
                id: r.Id,
                text: r.Text || '',
                dueDate: r.DueDate || r['Due Date'] || null,
                dueTime: r.DueTime || r['Due Time'] || null,
                assigneeId: r.AssigneeID || r['Assignee ID'] || null,
                createdAt: r.CreatedAt || r['Created At'],
                createdVia: r.CreatedVia || r['Created Via'] || 'web'
            }));
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reminders', async (req, res) => {
    try {
        const data = {
            'Text': req.body.text,
            'DueDate': req.body.dueDate || null,
            'DueTime': req.body.dueTime || null,
            'AssigneeID': req.body.assigneeId || null,
            'CreatedVia': req.body.createdVia || 'web',
            'Archived': false
        };
        const result = await nocodb.createRecord('reminders', data);
        console.log(`[API] Reminder created: "${req.body.text}"`);
        res.json({ id: result.Id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/reminders/:id', async (req, res) => {
    try {
        const data = {};
        if (req.body.text !== undefined) data['Text'] = req.body.text;
        if (req.body.dueDate !== undefined) data['DueDate'] = req.body.dueDate;
        if (req.body.dueTime !== undefined) data['DueTime'] = req.body.dueTime;
        if (req.body.assigneeId !== undefined) data['AssigneeID'] = req.body.assigneeId;
        if (req.body.archived !== undefined) {
            data['Archived'] = req.body.archived;
            if (req.body.archived) data['ArchivedAt'] = new Date().toISOString();
        }
        await nocodb.updateRecord('reminders', parseInt(req.params.id), data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/reminders/:id', async (req, res) => {
    try {
        await nocodb.deleteRecord('reminders', parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== SETTINGS ====================
let globalSettings = {
    timezone: 'Asia/Ho_Chi_Minh',
    defaultRemindTime: '10:00',
    discordChannelId: '1465902062146555915' // akubot-notifications
};

app.get('/api/settings', (req, res) => {
    res.json(globalSettings);
});

app.post('/api/settings', (req, res) => {
    if (req.body.timezone) globalSettings.timezone = req.body.timezone;
    if (req.body.defaultRemindTime) globalSettings.defaultRemindTime = req.body.defaultRemindTime;
    if (req.body.discordChannelId) {
        globalSettings.discordChannelId = req.body.discordChannelId;
        // Update Discord service
        discord.setChannelId(req.body.discordChannelId);
    }
    console.log('[Settings] Updated:', globalSettings);
    res.json({ success: true, settings: globalSettings });
});

// ==================== MANUAL NOTIFICATION TRIGGER ====================
app.post('/api/notifications/check', async (req, res) => {
    try {
        await notificationCron.runAllChecks();
        res.json({ success: true, message: 'Notification check triggered' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nudge a task assignee
app.post('/api/tasks/:id/nudge', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await nocodb.getRecord('tasks', taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        if (!task['Assignee ID']) {
            return res.status(400).json({ error: 'Task has no assignee to nudge' });
        }
        
        // Get assignee for mention
        const ASSIGNEES = {
            1: { name: 'Brendon', discordId: '147649565330243584' },
            2: { name: 'Ivy', discordId: '623156654199930882' }
        };
        const assignee = ASSIGNEES[task['Assignee ID']];
        
        if (!assignee) {
            return res.status(400).json({ error: 'Unknown assignee' });
        }
        
        // Send nudge notification
        const message = `🔔 Nudge: ${task.Title}`;
        await discord.sendNotification(message, assignee.discordId);
        
        console.log(`[API] Nudge sent for task "${task.Title}" to ${assignee.name}`);
        res.json({ success: true, message: `Nudge sent to ${assignee.name}` });
    } catch (error) {
        console.error('[API] Failed to send nudge:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Send manual reminder for a specific task
app.post('/api/tasks/:id/remind', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await nocodb.getRecord('tasks', taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Get assignee for mention
        const ASSIGNEES = {
            1: { name: 'Brendon', discordId: '147649565330243584' },
            2: { name: 'Ivy', discordId: '623156654199930882' }
        };
        const assignee = task['Assignee ID'] ? ASSIGNEES[task['Assignee ID']] : null;
        
        // Build reminder embed
        const embed = discord.buildTaskEmbed(task, 'reminder', null);
        embed.title = `🔔 Reminder - ${task.Title}`;
        embed.color = 0x9B59B6; // Purple for manual reminders
        embed.footer = { text: 'Manual reminder • React ✅ when done' };
        
        const response = await discord.sendEmbedNotification(embed, assignee?.discordId);
        
        // Store message ID for reaction tracking
        if (response && response.id) {
            await nocodb.updateRecord('tasks', taskId, {
                'NotificationMessageId': response.id
            });
        }
        
        console.log(`[API] Manual reminder sent for task "${task.Title}"`);
        res.json({ success: true, messageId: response?.id });
    } catch (error) {
        console.error('[API] Failed to send reminder:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================== DATABASE SETUP ====================
app.post('/api/setup', async (req, res) => {
    try {
        // Create additional tables if they don't exist
        const tables = [
            {
                name: 'Subtasks',
                columns: [
                    { column_name: 'parent_task_id', title: 'Parent Task ID', uidt: 'Number' },
                    { column_name: 'title', title: 'Title', uidt: 'SingleLineText' },
                    { column_name: 'completed', title: 'Completed', uidt: 'Checkbox' }
                ]
            },
            {
                name: 'People',
                columns: [
                    { column_name: 'name', title: 'Name', uidt: 'SingleLineText' },
                    { column_name: 'discord_id', title: 'Discord ID', uidt: 'SingleLineText' },
                    { column_name: 'email', title: 'Email', uidt: 'Email' }
                ]
            },
            {
                name: 'Task_Assignees',
                columns: [
                    { column_name: 'task_id', title: 'Task ID', uidt: 'Number' },
                    { column_name: 'person_id', title: 'Person ID', uidt: 'Number' }
                ]
            },
            {
                name: 'Task_Tags',
                columns: [
                    { column_name: 'task_id', title: 'Task ID', uidt: 'Number' },
                    { column_name: 'tag_id', title: 'Tag ID', uidt: 'Number' }
                ]
            },
            {
                name: 'Notification_Settings',
                columns: [
                    { column_name: 'task_id', title: 'Task ID', uidt: 'Number' },
                    { column_name: 'notify_on_due', title: 'Notify On Due', uidt: 'Checkbox' },
                    { column_name: 'notify_days_before', title: 'Notify Days Before', uidt: 'Number' }
                ]
            }
        ];

        const results = [];
        for (const table of tables) {
            try {
                const result = await nocodb.createTable(table.name, table.columns);
                results.push({ table: table.name, status: 'created', id: result.id });
            } catch (error) {
                results.push({ table: table.name, status: 'exists or error', error: error.message });
            }
        }

        // Update tasks table with new columns
        // (Would need to use NocoDB's column API to add to existing table)

        // Add default people (Brendon and Ivy)
        await nocodb.init(); // Refresh table list
        
        try {
            await nocodb.createRecord('people', { 'Name': 'Brendon', 'Discord ID': '147649565330243584' });
            await nocodb.createRecord('people', { 'Name': 'Ivy', 'Discord ID': '623156654199930882' });
            results.push({ action: 'Added default users', status: 'success' });
        } catch (e) {
            results.push({ action: 'Add users', status: 'skipped', error: e.message });
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize and start
async function start() {
    await nocodb.init();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Dash running on http://0.0.0.0:${PORT}`);
    });

    // Start notification cron jobs
    notificationCron.start();
}

start().catch(console.error);
