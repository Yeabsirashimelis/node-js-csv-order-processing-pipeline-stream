const express = require('express');
const { OrderPipeline } = require('./pipeline');

const app = express();
app.use(express.json());

const pipeline = new OrderPipeline();

app.post('/process', async (req, res) => {
    const { filePath } = req.body;

    pipeline.on('order_processed', (data) => {
        console.log(`Processed: ${data.order.order_id}`);
    });

    pipeline.on('validation_error', (data) => {
        console.log(`Validation failed: ${JSON.stringify(data.order)}`);
    });

    pipeline.on('complete', (data) => {
        console.log(`Complete: ${JSON.stringify(data)}`);
    });

    try {
        await pipeline.processFile(filePath);
        res.json(pipeline.getMetrics());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', metrics: pipeline.getMetrics() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Pipeline server running on port ${PORT}`);
});
