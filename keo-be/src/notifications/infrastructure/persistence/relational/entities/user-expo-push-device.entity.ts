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
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'user_expo_push_devices',
})
@Index('idx_user_expo_push_devices_user_id', ['user'])
@Index('idx_user_expo_push_devices_is_enabled', ['isEnabled'])
export class UserExpoPushDeviceEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, {
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: UserEntity;

  @Column({
    name: 'expo_push_token',
    type: 'text',
    unique: true,
  })
  expoPushToken: string;

  @Column({
    type: String,
    length: 15,
  })
  platform: string;

  @Column({
    name: 'eas_project_id',
    type: String,
    length: 80,
    nullable: true,
  })
  easProjectId: string | null;

  @Column({
    name: 'eas_environment',
    type: String,
    length: 50,
    nullable: true,
  })
  easEnvironment: string | null;

  @Column({
    name: 'is_enabled',
    type: 'boolean',
    default: true,
  })
  isEnabled: boolean;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastSeenAt: Date | null;

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
