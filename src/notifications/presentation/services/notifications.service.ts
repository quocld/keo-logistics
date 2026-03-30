import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../../ops/infrastructure/persistence/relational/entities/notification.entity';
import { ExpoPushQueue } from '../../infrastructure/queues/expo-push.queue';
import { type ExpoPushSendJobData } from '../../worker/expo-push-job.types';

type CreateNotificationAndEnqueueArgs = {
  userId: number;
  title: string;
  message: string;
  type: string | null;
  /**
   * Custom payload delivered to client when user taps the push.
   * Keep only IDs/short strings.
   */
  pushData: ExpoPushSendJobData['pushData'];
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly expoPushQueue: ExpoPushQueue,
  ) {}

  async createNotificationAndEnqueue(
    args: CreateNotificationAndEnqueueArgs,
  ): Promise<NotificationEntity> {
    const notification = this.notificationsRepository.create({
      user: { id: args.userId } as any,
      title: args.title,
      message: args.message,
      type: args.type,
      isRead: false,
    });

    const saved = await this.notificationsRepository.save(notification);

    await this.expoPushQueue.enqueueSend({
      notificationId: saved.id,
      pushData: args.pushData,
    });

    return saved;
  }
}
