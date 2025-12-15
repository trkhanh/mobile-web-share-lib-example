/**
 * Logger port
 *
 * SOLID notes:
 * - Interface Segregation: the logger exposes a minimal API for logging levels
 *   used by services. Consumers aren't forced to depend on unrelated logging
 *   methods.
 * - Dependency Inversion: services depend on this abstraction (`ILogger`) so
 *   concrete logging (console, structured logger, external telemetry) can be
 *   provided at composition time.
 */
export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
