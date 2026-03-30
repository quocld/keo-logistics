import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'driver_locations',
})
@Index('idx_driver_locations_driver_time', ['driver', 'timestamp'])
@Index('idx_driver_locations_timestamp', ['timestamp'])
export class DriverLocationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, {
    nullable: false,
  })
  @JoinColumn({
    name: 'driver_id',
  })
  driver: UserEntity;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 8,
  })
  latitude: string;

  @Column({
    type: 'numeric',
    precision: 11,
    scale: 8,
  })
  longitude: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  speed: string | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  accuracy: string | null;

  @Column({
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  timestamp: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
