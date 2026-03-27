import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '.././utils/validate-config';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT: number;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_DOMAIN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;
}

function resolveAppPort(): number {
  const fromPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
  const dbPort = process.env.DATABASE_PORT
    ? parseInt(process.env.DATABASE_PORT, 10)
    : 5432;

  if (!Number.isNaN(fromPort) && fromPort === dbPort) {
    throw new Error(
      'PORT must not equal DATABASE_PORT (Postgres). On Railway, delete any manual PORT on the API service — the platform injects the HTTP port. DATABASE_PORT/PGPORT is only for the database.',
    );
  }

  if (
    !Number.isNaN(fromPort) &&
    fromPort === 5432 &&
    process.env.DATABASE_TYPE === 'postgres'
  ) {
    throw new Error(
      'PORT=5432 is the PostgreSQL default. Remove PORT from the API service env so Railway sets the HTTP port, or you will never pass health checks.',
    );
  }

  if (!Number.isNaN(fromPort)) {
    return fromPort;
  }
  if (process.env.APP_PORT) {
    return parseInt(process.env.APP_PORT, 10);
  }
  return 3000;
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    // `PORT` is the standard env var used by Railway/Nixpacks.
    // Prefer it over `APP_PORT` because local `.env` may ship with APP_PORT=3000.
    port: resolveAppPort(),
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
  };
});
