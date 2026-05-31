import { Queue } from 'bullmq';

const connection = { host: 'localhost', port: 6379 };

export const worldEventsQueue = new Queue('world-events', { connection });
export const aiSummariesQueue = new Queue('ai-summaries', { connection });