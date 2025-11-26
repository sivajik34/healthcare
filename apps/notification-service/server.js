import { WebSocketServer } from 'ws';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

const PORT = process.env.PORT || 9001;
const KAFKA_BOOTSTRAP = process.env.KAFKA_BOOTSTRAP || 'localhost:29092';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const wss = new WebSocketServer({ port: PORT });
const kafka = new Kafka({ brokers: [KAFKA_BOOTSTRAP] });
const consumer = kafka.consumer({ groupId: 'notifications-ws' });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    try {
      if (client.readyState === 1) client.send(msg);
    } catch (e) {
      // ignore
    }
  });
}

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'patient.events', fromBeginning: false });
  await consumer.subscribe({ topic: 'appointment.events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value?.toString();
      const payload = { topic, event: value ? JSON.parse(value) : {} };
      broadcast(payload);
      // optional: publish to Redis for other consumers
      try {
        await redis.publish('notifications', JSON.stringify(payload));
      } catch {}
    },
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to notifications' }));
});

run().catch((err) => {
  console.error('Notification service failed:', err);
  process.exit(1);
});

console.log(`WebSocket server listening on ws://0.0.0.0:${PORT}`);


