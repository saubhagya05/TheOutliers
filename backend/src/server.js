import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFound } from './lib/http.js';
import { generalRouter } from './routes/general.js';
import { ringsRouter } from './routes/rings.js';
import { loneRouter } from './routes/lone.js';
import { recordsRouter } from './routes/records.js';
import { stressRouter } from './routes/stress.js';
import { datasetsRouter } from './routes/datasets.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));   // dataset uploads arrive as CSV text

app.use('/api', generalRouter);
app.use('/api/rings', ringsRouter);
app.use('/api/lone', loneRouter);
app.use('/api/records', recordsRouter);
app.use('/api/stress-test', stressRouter);
app.use('/api/datasets', datasetsRouter);

app.use('/api', (req, res, next) => next(notFound(`No route ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API on http://localhost:${config.port}/api (mode: ${config.mock ? 'mock' : 'live, ML at ' + config.mlUrl})`);
});
