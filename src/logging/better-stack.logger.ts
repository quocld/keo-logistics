import { Logtail } from '@logtail/node';
import {
  Injectable,
  LoggerService,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class BetterStackLogger implements LoggerService, OnApplicationShutdown {
  private readonly logtail: Logtail | null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const token = this.configService.get('app.betterStackSourceToken', {
      infer: true,
    });
    const enabled = this.configService.get('app.betterStackEnabled', {
      infer: true,
    });
    const endpoint = this.configService.get('app.betterStackEndpoint', {
      infer: true,
    });

    if (token && enabled) {
      this.logtail = new Logtail(token, endpoint ? { endpoint } : undefined);
    } else {
      this.logtail = null;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.logtail?.flush().catch(() => undefined);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
    this.toBetterStack('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
    this.toBetterStack('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    console.warn(message, ...optionalParams);
    this.toBetterStack('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    console.debug(message, ...optionalParams);
    this.toBetterStack('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
    this.toBetterStack('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
    this.toBetterStack('error', message, optionalParams);
  }

  private toBetterStack(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.logtail) {
      return;
    }
    const msg = this.formatMessage(message);
    const context = this.nestContext(optionalParams);
    const run = (): Promise<unknown> => {
      switch (level) {
        case 'debug':
          return this.logtail!.debug(msg, context);
        case 'info':
          return this.logtail!.info(msg, context);
        case 'warn':
          return this.logtail!.warn(msg, context);
        case 'error':
          return this.logtail!.error(msg, context);
      }
    };
    void run().catch(() => undefined);
  }

  private formatMessage(message: unknown): string | Error {
    if (message instanceof Error) {
      return message;
    }
    if (typeof message === 'string') {
      return message;
    }
    if (typeof message === 'object' && message !== null) {
      try {
        return JSON.stringify(message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  }

  private nestContext(
    optionalParams: unknown[],
  ): Record<string, unknown> | undefined {
    if (!optionalParams.length) {
      return undefined;
    }
    if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
      return { nestContext: optionalParams[0] };
    }
    return { nestExtras: optionalParams };
  }
}
