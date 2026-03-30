import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../../ops/infrastructure/persistence/relational/entities/notification.entity';
import { NotificationDeliveryEntity } from '../infrastructure/persistence/relational/entities/notification-delivery.entity';
import { UserExpoPushDeviceEntity } from '../infrastructure/persistence/relational/entities/user-expo-push-device.entity';
import { ExpoPushDeliveryService } from '../services/expo-push-delivery.service';
import { ExpoPushWorker } from './expo-push.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationDeliveryEntity,
      UserExpoPushDeviceEntity,
    ]),
  ],
  providers: [ExpoPushDeliveryService, ExpoPushWorker],
})
export class ExpoPushWorkerModule {}
