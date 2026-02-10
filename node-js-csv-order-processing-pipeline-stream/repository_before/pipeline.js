const fs = require('fs');
const { EventEmitter } = require('events');
const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/orders',
    max: 5,
});

class OrderPipeline extends EventEmitter {
    constructor(options = {}) {
        super();
        this.batchSize = options.batchSize || 100;
        this.processed = 0;
        this.failed = 0;
        this.webhookUrl = options.webhookUrl || 'http://localhost:3001/notify';
    }

    async processFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const headers = lines[0].split(',');

        const orders = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',');
            const order = {};
            headers.forEach((h, idx) => {
                order[h.trim()] = values[idx]?.trim();
            });
            orders.push(order);
        }

        this.emit('file_loaded', { count: orders.length, file: filePath });

        const batches = [];
        for (let i = 0; i < orders.length; i += this.batchSize) {
            batches.push(orders.slice(i, i + this.batchSize));
        }

        for (const batch of batches) {
            await Promise.all(batch.map(order => this.processOrder(order)));
        }

        this.emit('complete', { processed: this.processed, failed: this.failed });
    }

    async processOrder(order) {
        const validated = this.validate(order);
        if (!validated) {
            this.failed++;
            this.emit('validation_error', { order });
            return;
        }

        const enriched = await this.enrich(order);
        await this.save(enriched);
        await this.notify(enriched);
        this.processed++;
        this.emit('order_processed', { order: enriched });
    }

    validate(order) {
        if (!order.order_id || !order.customer_email || !order.amount) {
            return false;
        }
        if (parseFloat(order.amount) <= 0) {
            return false;
        }
        return true;
    }

    async enrich(order) {
        const enriched = { ...order };
        enriched.amount = parseFloat(order.amount);
        enriched.processed_at = new Date().toISOString();

        let metricsLog = '';
        for (const [key, value] of Object.entries(enriched)) {
            metricsLog += `${key}=${value} `;
        }
        console.log(`Enriched: ${metricsLog}`);

        return enriched;
    }

    async save(order) {
        const client = await pool.connect();
        try {
            await client.query(
                'INSERT INTO orders (order_id, customer_email, amount, status, processed_at) VALUES ($1, $2, $3, $4, $5)',
                [order.order_id, order.customer_email, order.amount, 'processed', order.processed_at]
            );
        } finally {
            client.release();
        }
    }

    async notify(order) {
        return new Promise((resolve) => {
            const data = JSON.stringify(order);
            const url = new URL(this.webhookUrl);

            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                },
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    resolve(body);
                });
            });

            req.on('error', (err) => {
                console.log(`Notification failed for ${order.order_id}: ${err.message}`);
                resolve();
            });

            req.write(data);
            req.end();
        });
    }

    async processBatch(filePaths) {
        let allResults = '';
        for (const filePath of filePaths) {
            await this.processFile(filePath);
            allResults += `File: ${filePath}, Processed: ${this.processed}, Failed: ${this.failed}\n`;
        }
        return allResults;
    }

    getMetrics() {
        return {
            processed: this.processed,
            failed: this.failed,
        };
    }
}

module.exports = { OrderPipeline };
