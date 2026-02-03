// NocoDB API Service
const axios = require('axios');

class NocoDBService {
    constructor() {
        this.baseUrl = process.env.NOCODB_URL || 'http://localhost:8080';
        this.token = process.env.NOCODB_TOKEN;
        this.baseId = process.env.NOCODB_BASE_ID;
        this.tables = {};
    }

    async init() {
        // Get all tables and store their IDs
        try {
            const response = await this.request(`meta/bases/${this.baseId}/tables`);
            for (const table of response.list || []) {
                this.tables[table.title.toLowerCase()] = table.id;
            }
            console.log('NocoDB tables loaded:', Object.keys(this.tables));
        } catch (error) {
            console.error('Failed to load NocoDB tables:', error.message);
        }
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
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        
        let endpoint = `tables/${tableId}/records`;
        if (params.where) endpoint += `?where=${encodeURIComponent(params.where)}`;
        
        return this.request(endpoint);
    }

    async getRecord(tableName, id) {
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records/${id}`);
    }

    async createRecord(tableName, data) {
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records`, {
            method: 'POST',
            body: data
        });
    }

    async updateRecord(tableName, id, data) {
        const tableId = this.tables[tableName.toLowerCase()];
        if (!tableId) throw new Error(`Table ${tableName} not found`);
        return this.request(`tables/${tableId}/records`, {
            method: 'PATCH',
            body: { Id: id, ...data }
        });
    }

    async deleteRecord(tableName, id) {
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
