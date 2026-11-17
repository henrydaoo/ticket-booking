import { randomUUID } from 'node:crypto';
import { Kafka } from 'kafkajs';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const dlqTopic = required('DLQ_TOPIC');
const sourceTopic = required('DLQ_SOURCE_TOPIC');
const confirmation = required('DLQ_REPLAY_CONFIRM');
if (confirmation !== `REPLAY:${sourceTopic}`) {
  throw new Error('DLQ_REPLAY_CONFIRM must equal REPLAY:<DLQ_SOURCE_TOPIC>');
}
if (!dlqTopic.endsWith('.dlq.v1')) {
  throw new Error('DLQ_TOPIC must end with .dlq.v1');
}

const brokers = required('KAFKA_BROKERS').split(',').map((value) => value.trim()).filter(Boolean);
const kafka = new Kafka({ clientId: `dlq-replay-${randomUUID()}`, brokers });
const consumer = kafka.consumer({ groupId: `dlq-replay-${randomUUID()}` });
const producer = kafka.producer();
const limit = Number.parseInt(process.env.DLQ_REPLAY_LIMIT ?? '1', 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error('DLQ_REPLAY_LIMIT must be an integer between 1 and 100');
}

let replayed = 0;
try {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: dlqTopic, fromBeginning: false });
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ message, partition }) => {
      if (replayed >= limit) return;
      if (!message.value) throw new Error('DLQ message has no envelope');
      const envelope = JSON.parse(message.value.toString('utf8'));
      if (
        envelope.contract !== 'ticket-booking.kafka-dlq' ||
        envelope.contractVersion !== 1 ||
        envelope.sourceTopic !== sourceTopic
      ) {
        throw new Error('DLQ envelope contract or source topic mismatch');
      }
      await producer.send({
        topic: sourceTopic,
        messages: [{
          key: envelope.eventId ?? `${sourceTopic}:${envelope.sourcePartition}:${envelope.sourceOffset}`,
          value: JSON.stringify(envelope.payload),
          headers: { 'x-dlq-replayed': 'true', 'x-dlq-envelope-id': `${dlqTopic}:${partition}:${message.offset}` },
        }],
      });
      await consumer.commitOffsets([{
        topic: dlqTopic,
        partition,
        offset: (BigInt(message.offset) + 1n).toString(),
      }]);
      replayed += 1;
      if (replayed >= limit) await consumer.stop();
    },
  });
} finally {
  await consumer.disconnect();
  await producer.disconnect();
}

console.log(`Replayed ${replayed} message(s) from ${dlqTopic} to ${sourceTopic}.`);
