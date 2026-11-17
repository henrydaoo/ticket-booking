import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const technicalErrors = new Rate('technical_errors');
export const businessConflicts = new Counter('business_conflicts');
export const requestDuration = new Trend('request_duration_ms');

export function required(name) {
  const value = __ENV[name];
  if (!value) {
    fail(`Missing required performance environment variable: ${name}`);
  }
  return value;
}

export function baseUrl() {
  return required('PERF_BASE_URL').replace(/\/+$/, '');
}

export function correlationId() {
  return `perf-${__VU}-${__ITER}-${Date.now()}`;
}

export function jsonHeaders(token, idempotencyKey) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

export function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function classify(response, name) {
  const technical = response.status === 0 || response.status >= 500;
  technicalErrors.add(technical ? 1 : 0);
  requestDuration.add(response.timings.duration);

  if (response.status === 409 || response.status === 422) {
    businessConflicts.add(1);
  }

  check(response, {
    [`${name} returned a response`]: (result) => result.status > 0,
  });

  return response;
}

export function login() {
  const response = classify(
    http.post(
      `${baseUrl()}/auth/login`,
      JSON.stringify({
        email: required('PERF_CUSTOMER_EMAIL'),
        password: required('PERF_CUSTOMER_PASSWORD'),
      }),
      { headers: jsonHeaders() },
    ),
    'login',
  );
  const payload = parseJson(response);
  if (response.status < 200 || response.status >= 300 || !payload?.accessToken) {
    fail(`Performance login failed with HTTP ${response.status}`);
  }
  return payload.accessToken;
}

export function getShowtimeId() {
  return required('PERF_SHOWTIME_ID');
}

export function getSeatId() {
  return required('PERF_SEAT_ID');
}

export function authRequest(method, path, token, body, idempotencyKey) {
  const params = { headers: jsonHeaders(token, idempotencyKey) };
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return classify(http.request(method, `${baseUrl()}${path}`, payload, params), path);
}

export function defaultThresholds() {
  return {
    http_req_failed: ['rate<0.01'],
    technical_errors: ['rate<0.01'],
    request_duration_ms: ['p(95)<800'],
  };
}
