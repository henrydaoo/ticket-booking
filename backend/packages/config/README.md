# Backend configuration package

`@ticket-booking/config` is a technical package for validating the small set of runtime settings shared by backend applications.

## Ownership

The package is owned by the backend foundation and contains no business concepts, database models, service workflows, or domain events. Backend applications remain responsible for their own service-specific configuration and secrets.

## Current consumers

The API Gateway and Identity Service configuration tests exercise the package as independent consumers. The remaining backend applications can adopt it when their bootstrap steps are implemented.

## Validated settings

- `SERVICE_NAME` is required.
- `PORT` is required and must be between 1 and 65535.
- `NODE_ENV` defaults to `development` and accepts `development`, `test`, or `production`.
- `LOG_LEVEL` defaults to `info` and accepts the supported structured-log levels.

Secret values are not logged or included in validation errors.

