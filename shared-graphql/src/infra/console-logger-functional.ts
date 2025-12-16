import { ILogger } from '../ports/logger';

/**
 * Functional logger factory
 * 
 * No class needed - just a factory returning an object
 * Pure dependency injection with no hidden state
 */
export const createConsoleLogger = (): ILogger => ({
  info: (message: string, meta?: any) => {
    console.log('[INFO]', message, meta ?? '');
  },
  warn: (message: string, meta?: any) => {
    console.warn('[WARN]', message, meta ?? '');
  },
  error: (message: string, meta?: any) => {
    console.error('[ERROR]', message, meta ?? '');
  }
});
