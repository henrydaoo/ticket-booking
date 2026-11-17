import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  LoggerService,
  NestInterceptor,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import pino, { Logger } from 'pino';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

export const OBSERVABILITY = Symbol('OBSERVABILITY');

export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ context: optionalParams[0] }, String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(
      { context: optionalParams[0], error: optionalParams[1] },
      String(message),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: optionalParams[0] }, String(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: optionalParams[0] }, String(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace({ context: optionalParams[0] }, String(message));
  }
}

export interface Observability {
  logger: Logger;
  registry: Registry;
  httpRequests: Counter<'method' | 'route' | 'status'>;
  httpDuration: Histogram<'method' | 'route'>;
  outboxBacklog: Gauge<'state'>;
  kafkaConsumerLag: Gauge<'topic' | 'group'>;
  workflowEvents: Counter<'workflow' | 'outcome'>;
  retries: Counter<'component' | 'operation'>;
  dlqMessages: Gauge<'component'>;
}

export function createObservability(service: string): Observability {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'ticket_booking_' });
  const logger = pino({
    base: { service },
    redact: {
      paths: [
        'req.headers.authorization',
        'authorization',
        'accessToken',
        'refreshToken',
        'password',
        'secret',
        'hashSecret',
        'qrToken',
      ],
      censor: '[REDACTED]',
    },
  });

  return {
    logger,
    registry,
    httpRequests: new Counter({
      name: 'ticket_booking_http_requests_total',
      help: 'HTTP requests handled by the service',
      labelNames: ['method', 'route', 'status'],
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: 'ticket_booking_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      registers: [registry],
    }),
    outboxBacklog: new Gauge({
      name: 'ticket_booking_outbox_backlog',
      help: 'Current Outbox rows by state',
      labelNames: ['state'],
      registers: [registry],
    }),
    kafkaConsumerLag: new Gauge({
      name: 'ticket_booking_kafka_consumer_lag',
      help: 'Kafka consumer lag when available from the consumer runtime',
      labelNames: ['topic', 'group'],
      registers: [registry],
    }),
    workflowEvents: new Counter({
      name: 'ticket_booking_workflow_events_total',
      help: 'Workflow outcomes and state transitions',
      labelNames: ['workflow', 'outcome'],
      registers: [registry],
    }),
    retries: new Counter({
      name: 'ticket_booking_retries_total',
      help: 'Retry attempts by component and operation',
      labelNames: ['component', 'operation'],
      registers: [registry],
    }),
    dlqMessages: new Gauge({
      name: 'ticket_booking_dlq_messages',
      help: 'Current messages in a dead-letter state',
      labelNames: ['component'],
      registers: [registry],
    }),
  };
}

@Controller()
export class ObservabilityMetricsController {
  constructor(
    @Inject(OBSERVABILITY) private readonly observability: Observability,
  ) {}

  @Get('metrics')
  async metrics(@Headers('x-metrics-token') token?: string): Promise<string> {
    const expectedToken = process.env.METRICS_TOKEN?.trim();
    if (
      (process.env.NODE_ENV === 'production' || expectedToken) &&
      (!expectedToken || token !== expectedToken)
    ) {
      throw new UnauthorizedException('Metrics access is not authorized');
    }
    return this.observability.registry.metrics();
  }
}

export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly observability: Observability,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      url?: string;
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const method = request.method ?? 'UNKNOWN';
    const started = process.hrtime.bigint();
    const correlationId =
      (request as { headers?: Record<string, string | string[] | undefined> })
        .headers?.['x-correlation-id'] ?? 'missing';

    return next.handle().pipe(
      finalize(() => {
        const route = request.route?.path ?? request.url ?? 'unknown';
        const status = String(response.statusCode ?? 500);
        const durationSeconds =
          Number(process.hrtime.bigint() - started) / 1_000_000_000;
        this.observability.httpRequests.inc({ method, route, status });
        this.observability.httpDuration.observe(
          { method, route },
          durationSeconds,
        );
        this.observability.logger.info({
          event: 'http_request_completed',
          correlationId,
          method,
          route,
          status,
          durationMs: Math.round(durationSeconds * 1000),
        });
      }),
    );
  }
}

export function startTelemetry(service: string): NodeSDK | undefined {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    return undefined;
  }

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  process.env.OTEL_SERVICE_NAME = service;
  void sdk.start();
  return sdk;
}

