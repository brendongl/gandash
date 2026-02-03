// Discord Notification Service
const axios = require('axios');

class DiscordService {
    constructor() {
        // Use Discord bot token from environment
        this.botToken = process.env.DISCORD_BOT_TOKEN;
        if (!this.botToken) {
            console.warn('[Discord] No DISCORD_BOT_TOKEN found in environment. Discord notifications will be disabled.');
        }
        
        // Default notification channel (akubot-notifications)
        this.channelId = process.env.DISCORD_NOTIFICATION_CHANNEL || '1465902062146555915';
        
        // User mappings
        this.users = {
            'brendon': '147649565330243584',
            'ivy': '623156654199930882'
        };
    }

    setChannelId(channelId) {
        this.channelId = channelId;
    }

    async sendNotification(message, mentionUserId = null) {
        if (!this.botToken) {
            console.warn('[Discord] Bot token not configured, skipping notification');
            return null;
        }
        
        const content = mentionUserId ? `<@${mentionUserId}> ${message}` : message;
        
        try {
            const response = await axios.post(
                `https://discord.com/api/v10/channels/${this.channelId}/messages`,
                { content },
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('[Discord] Notification sent:', content.substring(0, 80) + '...');
            return response.data; // Contains { id: messageId, ... }
        } catch (error) {
            console.error('[Discord] Failed to send notification:', error.response?.data || error.message);
            throw error;
        }
    }

    async getMessageReactions(messageId, emoji = '✅') {
        try {
            // URL encode the emoji
            const encodedEmoji = encodeURIComponent(emoji);
            const response = await axios.get(
                `https://discord.com/api/v10/channels/${this.channelId}/messages/${messageId}/reactions/${encodedEmoji}`,
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`
                    }
                }
            );
            return response.data; // Array of users who reacted
        } catch (error) {
            // 10014 = Unknown Message (deleted), 10014 = Unknown Emoji (no reactions)
            if (error.response?.status === 404) {
                return []; // No reactions or message deleted
            }
            console.error('[Discord] Failed to get reactions:', error.response?.data || error.message);
            return [];
        }
    }

    async addReaction(messageId, emoji = '✅') {
        try {
            const encodedEmoji = encodeURIComponent(emoji);
            await axios.put(
                `https://discord.com/api/v10/channels/${this.channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
                {},
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('[Discord] Failed to add reaction:', error.response?.data || error.message);
            return false;
        }
    }

    getUserId(name) {
        return this.users[name.toLowerCase()] || name;
    }

    formatTaskNotification(task, type = 'due', daysBefore = null) {
        const emoji = {
            'due': '⏰',
            'reminder': '🔔',
            'overdue': '🚨'
        };
        
        const typeText = {
            'due': 'Due Now',
            'reminder': `Reminder (${daysBefore} day${daysBefore > 1 ? 's' : ''} left)`,
            'overdue': 'OVERDUE'
        };
        
        let message = `${emoji[type] || '📋'} **${typeText[type] || type}**\n`;
        message += `\n`;
        message += `📝 **${task.Title}**\n`;
        
        if (task.Description) {
            const desc = task.Description.length > 150 
                ? task.Description.substring(0, 150) + '...' 
                : task.Description;
            message += `> ${desc}\n`;
        }
        
        message += `\n`;
        
        if (task['Due Date']) {
            const dueDate = new Date(task['Due Date']);
            const dateStr = dueDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
            const timeStr = task['Due Date'].includes('T') 
                ? dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : null;
            message += `📅 ${dateStr}${timeStr ? ` at ${timeStr}` : ''}\n`;
        }
        
        if (task.Priority && task.Priority <= 2) {
            const priorityText = task.Priority === 1 ? 'URGENT' : 'High';
            message += `🔴 Priority: ${priorityText}\n`;
        }
        
        if (task['Project ID']) {
            // Could lookup project name here if needed
        }
        
        return message;
    }

    // Build embed object for task notifications
    buildTaskEmbed(task, type = 'due', daysBefore = null) {
        const colors = {
            'due': 0xFFA500,      // Orange
            'reminder': 0x3498DB, // Blue
            'overdue': 0xE74C3C,  // Red
            'completed': 0x2ECC71 // Green
        };

        const titles = {
            'due': `⏰ ${task.Title}`,
            'reminder': `🔔 ${task.Title}`,
            'overdue': `🚨 ${task.Title}`,
            'completed': `✅ ${task.Title}`
        };

        const statusText = {
            'due': 'Due Now',
            'reminder': `Reminder • ${daysBefore} day${daysBefore > 1 ? 's' : ''} left`,
            'overdue': 'OVERDUE',
            'completed': 'Completed'
        };

        const fields = [];
        
        if (task['Due Date']) {
            const dueDate = new Date(task['Due Date']);
            const dateStr = dueDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
            fields.push({ name: '📅 Due', value: dateStr, inline: true });
        }

        if (task.Priority && task.Priority <= 3) {
            const priorityText = task.Priority === 1 ? 'Urgent' : task.Priority === 2 ? 'High' : 'Medium';
            const priorityEmoji = task.Priority === 1 ? '🔴' : task.Priority === 2 ? '🟠' : '🟡';
            fields.push({ name: `${priorityEmoji} Priority`, value: priorityText, inline: true });
        }

        const embed = {
            title: titles[type] || `📋 ${task.Title}`,
            description: task.Description || null,
            color: colors[type] || 0x757575,
            fields: fields.length > 0 ? fields : undefined,
            footer: type === 'completed' ? 
                { text: `Completed • Auto-deletes in 7 days` } : 
                { text: `React ✅ when done` },
            timestamp: type === 'completed' ? new Date().toISOString() : undefined
        };

        // Add first image attachment if available
        const attachments = task.Attachments || [];
        if (attachments.length > 0) {
            // Find first image attachment
            const imageAttachment = attachments.find(a => 
                a.mimetype && a.mimetype.startsWith('image/')
            );
            if (imageAttachment && imageAttachment.signedUrl) {
                embed.image = { url: imageAttachment.signedUrl };
            } else if (imageAttachment && imageAttachment.url) {
                // Fallback to regular URL if signedUrl not available
                embed.image = { url: imageAttachment.url };
            }
        }

        return embed;
    }

    // Send notification with embed
    async sendEmbedNotification(embed, mentionUserId = null) {
        if (!this.botToken) {
            console.warn('[Discord] Bot token not configured, skipping embed notification');
            return null;
        }
        
        const content = mentionUserId ? `<@${mentionUserId}>` : undefined;
        
        try {
            const response = await axios.post(
                `https://discord.com/api/v10/channels/${this.channelId}/messages`,
                { content, embeds: [embed] },
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('[Discord] Embed notification sent');
            return response.data;
        } catch (error) {
            console.error('[Discord] Failed to send embed:', error.response?.data || error.message);
            throw error;
        }
    }

    // Edit message with new embed (for completion)
    async editMessageEmbed(messageId, embed) {
        try {
            const response = await axios.patch(
                `https://discord.com/api/v10/channels/${this.channelId}/messages/${messageId}`,
                { embeds: [embed] },
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('[Discord] Message edited to completed state');
            return response.data;
        } catch (error) {
            console.error('[Discord] Failed to edit message:', error.response?.data || error.message);
            return null;
        }
    }

    // Delete a message
    async deleteMessage(messageId) {
        try {
            await axios.delete(
                `https://discord.com/api/v10/channels/${this.channelId}/messages/${messageId}`,
                {
                    headers: {
                        'Authorization': `Bot ${this.botToken}`
                    }
                }
            );
            console.log(`[Discord] Deleted message ${messageId}`);
            return true;
        } catch (error) {
            console.error('[Discord] Failed to delete message:', error.response?.data || error.message);
            return false;
        }
    }
}

module.exports = new DiscordService();
