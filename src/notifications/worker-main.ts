import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpoPushWorkerModule } from './worker/expo-push-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(ExpoPushWorkerModule);
  Logger.log('Expo push worker started');
}

void bootstrap();
