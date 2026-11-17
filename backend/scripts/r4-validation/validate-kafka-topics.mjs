import { Kafka } from 'kafkajs';

const brokers = process.env.R4_KAFKA_BROKERS?.split(',').map((value) => value.trim()).filter(Boolean);
const expected = process.env.R4_KAFKA_TOPICS?.split(',').map((value) => value.trim()).filter(Boolean);
if (!brokers?.length || !expected?.length) {
  throw new Error('R4_KAFKA_BROKERS and R4_KAFKA_TOPICS are required');
}

const kafka = new Kafka({ clientId: 'r4-validation', brokers });
const admin = kafka.admin();
await admin.connect();
try {
  const topics = new Set(await admin.listTopics());
  const missing = expected.filter((topic) => !topics.has(topic));
  if (missing.length) throw new Error(`Missing Kafka topics: ${missing.join(', ')}`);
  console.log(`Verified ${expected.length} Kafka topic(s).`);
} finally {
  await admin.disconnect();
}
