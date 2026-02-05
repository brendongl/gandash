// NocoDB API Service
const axios = require('axios');

class NocoDBService {
    constructor() {
        this.baseUrl = process.env.NOCODB_URL || 'http://localhost:8080';
        this.token = process.env.NOCODB_TOKEN;
        this.baseId = process.env.NOCODB_BASE_ID;
        this.tables = {};
        this._initPromise = null;
        this._lastInitAttempt = 0;
    }

    async init() {
        // Get all tables and store their IDs
        try {
            const response = await this.request(`meta/bases/${this.baseId}/tables`);
            for (const table of response.list || []) {
                this.tables[table.title.toLowerCase()] = table.id;
            }
            console.log('NocoDB tables loaded:', Object.keys(this.tables));
            return true;
        } catch (error) {
            console.error('Failed to load NocoDB tables:', error.message);
            return false;
        }
    }

    // Ensure tables are loaded, retry if empty (lazy loading for resilience)
    async ensureTables() {
        if (Object.keys(this.tables).length > 0) return true;
        
        // Avoid hammering NocoDB - wait at least 5s between retries
        const now = Date.now();
        if (now - this._lastInitAttempt < 5000) {
            return false;
        }
        this._lastInitAttempt = now;
        
        console.log('[NocoDB] Tables empty, attempting to reload...');
        return this.init();
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api/v2/${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'xc-token': this.token
        };

        try {
            const response = await axios({
                url,
                method: options.method || 'GET',
                headers,
                data: options.body
            });
            return response.data;
        } catch (error) {
            console.error(`NocoDB API Error [${endpoint}]:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Generic CRUD operations
    async getRecords(tableName, params = {}) {
        await this.ensureTables();
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        
        let endpoint = `tables/${tableId}/records`;
        if (params.where) endpoint += `?where=${encodeURIComponent(params.where)}`;
        
        return this.request(endpoint);
    }

    async getRecord(tableName, id) {
        await this.ensureTables();
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records/${id}`);
    }

    async createRecord(tableName, data) {
        await this.ensureTables();
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records`, {
            method: 'POST',
            body: data
        });
    }

    async updateRecord(tableName, id, data) {
        await this.ensureTables();
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records`, {
            method: 'PATCH',
            body: { Id: id, ...data }
        });
    }

    async deleteRecord(tableName, id) {
        await this.ensureTables();
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records`, {
            method: 'DELETE',
            body: { Id: id }
        });
    }

    // Create table helper
    async createTable(tableName, columns) {
        return this.request(`meta/bases/${this.baseId}/tables`, {
            method: 'POST',
            body: {
                table_name: tableName.toLowerCase(),
                title: tableName,
                columns
            }
        });
    }
}

module.exports = new NocoDBService();
