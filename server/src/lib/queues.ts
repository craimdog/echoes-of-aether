import { Queue } from 'bullmq';

function getConnection() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? ({} as object) : undefined,
    };
  }
  return { host: 'localhost', port: 6379 };
}

const connection = getConnection();

export const worldEventsQueue = new Queue('world-events', { connection });
export const aiSummariesQueue = new Queue('ai-summaries', { connection });
