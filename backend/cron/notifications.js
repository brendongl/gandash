// Notification Cron Jobs
const cron = require('node-cron');
const nocodb = require('../services/nocodb');
const discord = require('../services/discord');

// Hardcoded assignee Discord IDs
const ASSIGNEES = {
    1: { name: 'Brendon', discordId: '147649565330243584' },
    2: { name: 'Ivy', discordId: '623156654199930882' }
};

class NotificationCron {
    constructor() {
        this.jobs = [];
        this.notifiedToday = new Set(); // Track what we've notified to avoid spam
    }

    start() {
        // Check every 15 minutes for due tasks and reminders
        const frequentCheck = cron.schedule('*/15 * * * *', () => {
            console.log('[Cron] Running notification check...');
            this.runAllChecks();
        });
        this.jobs.push(frequentCheck);

        // Reset notified set at midnight
        const resetDaily = cron.schedule('0 0 * * *', () => {
            this.notifiedToday.clear();
            console.log('[Cron] Reset daily notification tracker');
        });
        this.jobs.push(resetDaily);

        // Daily morning summary at 8 AM (Vietnam time = 1 AM UTC)
        const dailySummary = cron.schedule('0 1 * * *', () => {
            this.sendDailySummary();
        });
        this.jobs.push(dailySummary);

        // Archive old reminders at 11 PM (Vietnam time = 4 PM UTC)
        const archiveOld = cron.schedule('0 16 * * *', () => {
            this.archiveOldReminders();
        });
        this.jobs.push(archiveOld);

        console.log('[Cron] Notification jobs started (every 15 min)');
        
        // Run initial check after 10 seconds
        setTimeout(() => this.runAllChecks(), 10000);
    }

    async runAllChecks() {
        try {
            await this.checkDueTasks();
            await this.checkAdvanceReminders();
            await this.checkLateTasks();
            await this.checkReactionCompletions();
            await this.cleanupOldMessages();
        } catch (error) {
            console.error('[Cron] Error in notification checks:', error.message);
        }
    }

    async checkReactionCompletions() {
        try {
            const result = await nocodb.getRecords('tasks');
            const tasks = result.list || [];
            
            // Find pending tasks with a notification message ID
            const tasksToCheck = tasks.filter(task => {
                return task.Status !== 'completed' && 
                       task.Status !== 'done' && 
                       task['NotificationMessageId'];
            });

            for (const task of tasksToCheck) {
                const messageId = task['NotificationMessageId'];
                const reactions = await discord.getMessageReactions(messageId, '✅');
                
                if (reactions && reactions.length > 0) {
                    // Someone reacted with ✅ - mark task as done
                    const reactor = reactions[0];
                    console.log(`[Cron] Task "${task.Title}" marked done by ${reactor.username || reactor.id}`);
                    
                    // Calculate deletion date (7 days from now)
                    const deleteAt = new Date();
                    deleteAt.setDate(deleteAt.getDate() + 7);
                    
                    await nocodb.updateRecord('tasks', task.Id, {
                        'Status': 'done',
                        'Completed At': new Date().toISOString(),
                        'ScheduledDeleteAt': deleteAt.toISOString()
                    });

                    // Edit the original message to show completed state
                    const completedEmbed = discord.buildTaskEmbed(task, 'completed');
                    completedEmbed.description = `Completed by <@${reactor.id}>`;
                    await discord.editMessageEmbed(messageId, completedEmbed);
                    
                    console.log(`[Cron] Task "${task.Title}" completed, scheduled delete at ${deleteAt.toISOString()}`);
                }
            }

            if (tasksToCheck.length > 0) {
                console.log(`[Cron] Checked ${tasksToCheck.length} tasks for reaction completions`);
            }
        } catch (error) {
            console.error('[Cron] Error checking reaction completions:', error.message);
        }
    }

    async cleanupOldMessages() {
        try {
            const result = await nocodb.getRecords('tasks');
            const tasks = result.list || [];
            const now = new Date();
            
            // Find completed tasks past their scheduled delete time
            const tasksToCleanup = tasks.filter(task => {
                if (!task['ScheduledDeleteAt'] || !task['NotificationMessageId']) return false;
                const deleteAt = new Date(task['ScheduledDeleteAt']);
                return now >= deleteAt;
            });

            for (const task of tasksToCleanup) {
                const messageId = task['NotificationMessageId'];
                const deleted = await discord.deleteMessage(messageId);
                
                if (deleted) {
                    await nocodb.updateRecord('tasks', task.Id, {
                        'NotificationMessageId': null,
                        'ScheduledDeleteAt': null
                    });
                    console.log(`[Cron] Cleaned up notification for completed task "${task.Title}"`);
                }
            }

            if (tasksToCleanup.length > 0) {
                console.log(`[Cron] Cleaned up ${tasksToCleanup.length} old notification messages`);
            }
        } catch (error) {
            console.error('[Cron] Error cleaning up old messages:', error.message);
        }
    }

    async archiveOldReminders() {
        try {
            const result = await nocodb.getRecords('reminders');
            const reminders = result.list || [];
            const today = new Date().toISOString().split('T')[0];
            
            // Find reminders past their due date
            const toArchive = reminders.filter(r => {
                if (r.Archived) return false;
                const dueDate = (r.DueDate || r['Due Date'] || '').split('T')[0];
                return dueDate && dueDate < today;
            });

            for (const reminder of toArchive) {
                await nocodb.updateRecord('reminders', reminder.Id, {
                    'Archived': true,
                    'ArchivedAt': new Date().toISOString()
                });
                console.log(`[Cron] Archived reminder: "${reminder.Text}"`);
            }

            if (toArchive.length > 0) {
                console.log(`[Cron] Archived ${toArchive.length} old reminders`);
            }
        } catch (error) {
            console.error('[Cron] Error archiving reminders:', error.message);
        }
    }

    async checkDueTasks() {
        try {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getUTCHours() + 7; // Vietnam is UTC+7
            
            const result = await nocodb.getRecords('tasks');
            const tasks = result.list || [];
            
            const dueTasks = tasks.filter(task => {
                if (task.Status === 'completed' || task.Status === 'done') return false;
                if (!task['Due Date']) return false;
                if (task['Notify Enabled'] !== true && task['Notify Enabled'] !== 'true' && task['Notify Enabled'] !== 1) return false;
                
                const dueDate = task['Due Date'].split('T')[0];
                if (dueDate !== today) return false;
                
                // Check if due time has passed (or if no time, notify at 9 AM)
                if (task['Due Date'].includes('T')) {
                    const dueTime = new Date(task['Due Date']);
                    return now >= dueTime;
                } else {
                    return currentHour >= 9;
                }
            });

            for (const task of dueTasks) {
                const notifKey = `due-${task.Id}-${today}`;
                if (this.notifiedToday.has(notifKey)) continue;
                
                await this.sendTaskNotification(task, 'due');
                this.notifiedToday.add(notifKey);
            }

            if (dueTasks.length > 0) {
                console.log(`[Cron] Due tasks: ${dueTasks.length} notified`);
            }
        } catch (error) {
            console.error('[Cron] Error checking due tasks:', error.message);
        }
    }

    async checkAdvanceReminders() {
        try {
            const now = new Date();
            const currentHour = now.getUTCHours() + 7; // Vietnam time
            
            const result = await nocodb.getRecords('tasks');
            const tasks = result.list || [];
            
            for (const task of tasks) {
                if (task.Status === 'completed' || task.Status === 'done') continue;
                if (!task['Due Date']) continue;
                if (task['Notify Enabled'] !== true && task['Notify Enabled'] !== 'true' && task['Notify Enabled'] !== 1) continue;
                if (!task['Notify Days Before'] || task['Notify Days Before'] <= 0) continue;
                
                const dueDate = new Date(task['Due Date']);
                const reminderDate = new Date(dueDate);
                reminderDate.setDate(reminderDate.getDate() - task['Notify Days Before']);
                
                const todayStr = now.toISOString().split('T')[0];
                const reminderStr = reminderDate.toISOString().split('T')[0];
                
                if (todayStr !== reminderStr) continue;
                
                // Check reminder time (default 10:00 AM Vietnam)
                const notifyTime = task['Notify Time'] || '10:00';
                const [notifyHour] = notifyTime.split(':').map(Number);
                if (currentHour < notifyHour) continue;
                
                const notifKey = `reminder-${task.Id}-${todayStr}`;
                if (this.notifiedToday.has(notifKey)) continue;
                
                await this.sendTaskNotification(task, 'reminder', task['Notify Days Before']);
                this.notifiedToday.add(notifKey);
            }
        } catch (error) {
            console.error('[Cron] Error checking advance reminders:', error.message);
        }
    }

    async checkLateTasks() {
        try {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getUTCHours() + 7; // Vietnam time
            
            // Only send late notifications at 10 AM
            if (currentHour < 10 || currentHour >= 11) return;
            
            const result = await nocodb.getRecords('tasks');
            const tasks = result.list || [];
            
            const lateTasks = tasks.filter(task => {
                if (task.Status === 'completed' || task.Status === 'done') return false;
                if (!task['Due Date']) return false;
                if (task['Notify Enabled'] !== true && task['Notify Enabled'] !== 'true' && task['Notify Enabled'] !== 1) return false;
                if (task['Notify Late'] !== true && task['Notify Late'] !== 'true' && task['Notify Late'] !== 1) return false;
                
                const dueDate = task['Due Date'].split('T')[0];
                return dueDate < today;
            });

            for (const task of lateTasks) {
                const notifKey = `late-${task.Id}-${today}`;
                if (this.notifiedToday.has(notifKey)) continue;
                
                await this.sendTaskNotification(task, 'overdue');
                this.notifiedToday.add(notifKey);
            }

            if (lateTasks.length > 0) {
                console.log(`[Cron] Late tasks: ${lateTasks.length} notified`);
            }
        } catch (error) {
            console.error('[Cron] Error checking late tasks:', error.message);
        }
    }

    async sendTaskNotification(task, type, daysBefore = null) {
        try {
            const assigneeId = task['Assignee ID'];
            const assignee = assigneeId ? ASSIGNEES[assigneeId] : null;
            const discordUserId = assignee?.discordId || null;
            
            // Send as code block format for individual task
            const priorityEmoji = task.Priority <= 2 ? '🔴' : '📝';
            const priorityText = task.Priority <= 2 ? ' • High priority' : '';
            
            let timeText = '';
            if (task['Due Date'] && task['Due Date'].includes('T')) {
                const dueTime = new Date(task['Due Date']);
                timeText = ` at ${dueTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`;
            }
            
            const typeEmoji = type === 'overdue' ? '🚨' : type === 'reminder' ? '🔔' : '⏰';
            const typeLabel = type === 'overdue' ? 'OVERDUE' : type === 'reminder' ? `Reminder (${daysBefore}d left)` : 'Due Now';
            
            const mention = discordUserId ? `<@${discordUserId}> ` : '';
            const message = `${mention}${typeEmoji} **${typeLabel}**\n\`\`\`\n${priorityEmoji} ${task.Title}\n   Due${timeText}${priorityText}\n\`\`\`\n*React ✅ when done*`;
            
            const response = await discord.sendNotification(message, null);
            
            // Add ✅ reaction to the message
            if (response && response.id) {
                await discord.addReaction(response.id, '✅');
                await nocodb.updateRecord('tasks', task.Id, {
                    'NotificationMessageId': response.id
                });
                console.log(`[Cron] Stored message ID ${response.id} for task ${task.Id}`);
            }
            
            console.log(`[Cron] Sent ${type} notification for task "${task.Title}" to ${assignee?.name || 'channel'}`);
        } catch (error) {
            console.error(`[Cron] Failed to send notification for task ${task.Id}:`, error.message);
        }
    }

    async sendDailySummary() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Get tasks
            const tasksResult = await nocodb.getRecords('tasks');
            const tasks = tasksResult.list || [];
            
            const todayTasks = tasks.filter(task => {
                if (task.Status === 'completed' || task.Status === 'done') return false;
                if (!task['Due Date']) return false;
                return task['Due Date'].split('T')[0] === today;
            });

            const overdueTasks = tasks.filter(task => {
                if (task.Status === 'completed' || task.Status === 'done') return false;
                if (!task['Due Date']) return false;
                return task['Due Date'].split('T')[0] < today;
            });

            // Get reminders
            const remindersResult = await nocodb.getRecords('reminders');
            const reminders = (remindersResult.list || []).filter(r => {
                if (r.Archived) return false;
                const dueDate = (r.DueDate || r['Due Date'] || '').split('T')[0];
                // Include reminders due today or without a specific time (defaults to morning)
                return dueDate === today || (!r.DueTime && !r['Due Time'] && dueDate === today);
            });

            // Check if there's anything to send
            if (todayTasks.length === 0 && overdueTasks.length === 0 && reminders.length === 0) {
                console.log('[Cron] No tasks or reminders for daily summary');
                return;
            }

            // Send header
            await discord.sendNotification(`☀️ **Good Morning!** Here's your day:`, null);

            // Send each overdue task as separate message
            for (const task of overdueTasks) {
                const priorityEmoji = task.Priority <= 2 ? '🔴' : '📝';
                const priorityText = task.Priority <= 2 ? ' • High priority' : '';
                const message = `\`\`\`\n🚨 OVERDUE: ${task.Title}\n   Was due ${task['Due Date'].split('T')[0]}${priorityText}\n\`\`\``;
                
                const response = await discord.sendNotification(message, null);
                if (response && response.id) {
                    await discord.addReaction(response.id, '✅');
                    await nocodb.updateRecord('tasks', task.Id, { 'NotificationMessageId': response.id });
                }
            }

            // Send each today task as separate message
            for (const task of todayTasks) {
                const priorityEmoji = task.Priority <= 2 ? '🔴' : '📝';
                const priorityText = task.Priority <= 2 ? ' • High priority' : '';
                
                let timeText = '';
                if (task['Due Date'].includes('T')) {
                    const dueTime = new Date(task['Due Date']);
                    timeText = ` at ${dueTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`;
                }
                
                const message = `\`\`\`\n${priorityEmoji} ${task.Title}\n   Due${timeText}${priorityText}\n\`\`\``;
                
                const response = await discord.sendNotification(message, null);
                if (response && response.id) {
                    await discord.addReaction(response.id, '✅');
                    await nocodb.updateRecord('tasks', task.Id, { 'NotificationMessageId': response.id });
                }
            }

            // Send all reminders in one grouped box
            if (reminders.length > 0) {
                let reminderBlock = '```\n🔔 Reminders\n\n';
                for (const r of reminders) {
                    const text = r.Text || r.text || '';
                    reminderBlock += `• ${text}\n`;
                }
                reminderBlock += '```';
                
                await discord.sendNotification(reminderBlock, null);
            }

            console.log(`[Cron] Daily summary sent: ${overdueTasks.length} overdue, ${todayTasks.length} today, ${reminders.length} reminders`);
        } catch (error) {
            console.error('[Cron] Error sending daily summary:', error.message);
        }
    }

    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('[Cron] Notification jobs stopped');
    }
}

module.exports = new NotificationCron();
