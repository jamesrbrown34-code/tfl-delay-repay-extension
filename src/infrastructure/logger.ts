import type { Logger } from '../shared/types';

export class ExtensionLogger implements Logger {
  constructor(private readonly namespace: string) {}

  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[${this.namespace}] ${message}`, context ?? {});
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[${this.namespace}] ${message}`, context ?? {});
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.namespace}] ${message}`, context ?? {});
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[${this.namespace}] ${message}`, context ?? {});
  }
}
