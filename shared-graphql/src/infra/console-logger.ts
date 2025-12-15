import { ILogger } from '../ports/logger';

/**
 * ConsoleLogger
 *
 * SOLID notes:
 * - Single Responsibility: concrete logger that only forwards messages to the
 *   console. It does not implement business logic.
 * - Dependency Inversion: implements the `ILogger` abstraction so callers can
 *   depend on the interface rather than this specific implementation.
 */
export class ConsoleLogger implements ILogger {
  info(message: string, meta?: any) {
    console.log('[INFO]', message, meta ?? '');
  }
  warn(message: string, meta?: any) {
    console.warn('[WARN]', message, meta ?? '');
  }
  error(message: string, meta?: any) {
    console.error('[ERROR]', message, meta ?? '');
  }
}
