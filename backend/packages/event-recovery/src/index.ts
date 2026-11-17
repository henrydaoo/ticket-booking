import { Kafka, Producer } from 'kafkajs';

export type DeadLetterEnvelope = {
  contract: 'ticket-booking.kafka-dlq';
  contractVersion: 1;
  sourceTopic: string;
  sourcePartition: number;
  sourceOffset: string;
  failedAt: string;
  service: string;
  errorCode: string;
  errorMessage: string;
  correlationId?: string;
  eventId?: string;
  payload: unknown;
};

export function deadLetterTopic(sourceTopic: string): string {
  return `${sourceTopic}.dlq.v1`;
}

export function createDeadLetterEnvelope(input: {
  sourceTopic: string;
  sourcePartition: number;
  sourceOffset: string;
  service: string;
  error: unknown;
  payload: unknown;
}): DeadLetterEnvelope {
  const error = input.error instanceof Error ? input.error : new Error(String(input.error));
  const payload =
    input.payload && typeof input.payload === 'object'
      ? input.payload as { correlationId?: unknown; eventId?: unknown; id?: unknown }
      : undefined;
  return {
    contract: 'ticket-booking.kafka-dlq',
    contractVersion: 1,
    sourceTopic: input.sourceTopic,
    sourcePartition: input.sourcePartition,
    sourceOffset: input.sourceOffset,
    failedAt: new Date().toISOString(),
    service: input.service,
    errorCode: error.name || 'EVENT_PROCESSING_FAILED',
    errorMessage: error.message.slice(0, 1000),
    correlationId: typeof payload?.correlationId === 'string' ? payload.correlationId : undefined,
    eventId:
      typeof payload?.eventId === 'string'
        ? payload.eventId
        : typeof payload?.id === 'string'
          ? payload.id
          : undefined,
    payload: input.payload,
  };
}

export class KafkaDeadLetterPublisher {
  private readonly producer: Producer;
  private connected = false;

  constructor(
    kafka: Kafka,
    private readonly service: string,
  ) {
    this.producer = kafka.producer();
  }

  async publish(input: {
    sourceTopic: string;
    sourcePartition: number;
    sourceOffset: string;
    error: unknown;
    payload: unknown;
  }): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    const envelope = createDeadLetterEnvelope({ ...input, service: this.service });
    await this.producer.send({
      topic: deadLetterTopic(input.sourceTopic),
      messages: [
        {
          key: envelope.eventId ?? `${input.sourceTopic}:${input.sourcePartition}:${input.sourceOffset}`,
          value: JSON.stringify(envelope),
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}
