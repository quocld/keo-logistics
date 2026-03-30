import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { NotificationEntity } from '../../../../../ops/infrastructure/persistence/relational/entities/notification.entity';

@Entity({
  name: 'notification_deliveries',
})
@Index('idx_notification_deliveries_status', ['status'])
@Index(
  'idx_notification_deliveries_notification_token',
  ['notification', 'expoPushToken'],
  {
    unique: true,
  },
)
export class NotificationDeliveryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => NotificationEntity, {
    nullable: false,
  })
  @JoinColumn({
    name: 'notification_id',
  })
  notification: NotificationEntity;

  @Column({
    name: 'expo_push_token',
    type: 'text',
  })
  expoPushToken: string;

  @Column({
    type: 'character varying',
    length: 20,
    default: 'queued',
  })
  status: string;

  @Column({
    name: 'error_code',
    type: 'text',
    nullable: true,
  })
  errorCode: string | null;

  @Column({
    name: 'attempt_count',
    type: 'integer',
    default: 1,
  })
  attemptCount: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
