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
import { TripEntity } from './trip.entity';

@Entity({
  name: 'vehicle_locations',
})
@Index('idx_vehicle_locations_trip_time', ['trip', 'timestamp'])
@Index('idx_vehicle_locations_driver_time', ['driver', 'timestamp'])
@Index('idx_vehicle_locations_timestamp', ['timestamp'])
export class VehicleLocationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, {
    nullable: false,
  })
  @JoinColumn({
    name: 'driver_id',
  })
  driver: UserEntity;

  @ManyToOne(() => TripEntity, {
    nullable: false,
  })
  @JoinColumn({
    name: 'trip_id',
  })
  trip: TripEntity;

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
