import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'driver_profiles',
})
export class DriverProfileEntity extends EntityRelationalHelper {
  @PrimaryColumn({
    name: 'user_id',
    type: 'int',
  })
  userId: number;

  @OneToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: UserEntity;

  @Column({
    name: 'vehicle_plate',
    type: String,
    length: 20,
    nullable: true,
  })
  vehiclePlate: string | null;

  @Column({
    name: 'license_number',
    type: String,
    length: 30,
    nullable: true,
  })
  licenseNumber: string | null;

  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 5,
  })
  rating: string;

  @Column({
    name: 'total_trips',
    type: 'int',
    default: 0,
  })
  totalTrips: number;

  @Column({
    name: 'avg_tons_per_trip',
    type: 'numeric',
    precision: 8,
    scale: 2,
    default: 0,
  })
  avgTonsPerTrip: string;

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  updatedAt: Date;
}
