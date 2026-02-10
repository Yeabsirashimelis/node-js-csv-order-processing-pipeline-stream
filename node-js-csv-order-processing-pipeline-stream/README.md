# CSV Order Pipeline Fix

A Node.js service that processes CSV order files, validates and enriches orders, persists them to Postgres, and sends webhook notifications.

## Features
- Parses CSV files of orders
- Validates required fields and positive amounts
- Enriches orders with numeric amounts and timestamps
- Persists orders to Postgres
- Sends webhook notifications per order
- Exposes HTTP endpoints for processing and health checks

## Requirements
- Node.js 18+ (or compatible)
- Postgres database

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   - `DATABASE_URL` (default: `postgresql://localhost/orders`)
   - `PORT` (default: `3000`)
3. Ensure the `orders` table exists:
   ```sql
   CREATE TABLE IF NOT EXISTS orders (
     id SERIAL PRIMARY KEY,
     order_id TEXT NOT NULL,
     customer_email TEXT NOT NULL,
     amount NUMERIC NOT NULL,
     status TEXT NOT NULL,
     processed_at TIMESTAMP NOT NULL
   );
   ```

## Run
```bash
npm start
```

## API
### `POST /process`
Body:
```json
{ "filePath": "/path/to/orders.csv" }
```
Response:
```json
{ "processed": 10, "failed": 2 }
```

### `GET /health`
Response:
```json
{ "status": "ok", "metrics": { "processed": 10, "failed": 2 } }
```

## Notes
- CSV headers must include `order_id`, `customer_email`, and `amount`.
- Webhook notifications are sent to `http://localhost:3001/notify` by default.
