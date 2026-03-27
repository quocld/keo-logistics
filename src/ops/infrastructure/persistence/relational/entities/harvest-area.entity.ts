import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'harvest_areas',
})
export class HarvestAreaEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: String,
    length: 150,
  })
  name: string;

  @ManyToOne(() => UserEntity, {
    nullable: true,
  })
  @JoinColumn({
    name: 'owner_id',
  })
  owner: UserEntity | null;

  @Column({
    name: 'google_place_id',
    type: String,
    length: 100,
    nullable: true,
    unique: true,
  })
  googlePlaceId: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 8,
    nullable: true,
  })
  latitude: string | null;

  @Column({
    type: 'numeric',
    precision: 11,
    scale: 8,
    nullable: true,
  })
  longitude: string | null;

  @Column({
    name: 'formatted_address',
    type: 'text',
    nullable: true,
  })
  formattedAddress: string | null;

  @Column({
    name: 'address_components',
    type: 'jsonb',
    nullable: true,
  })
  addressComponents: Record<string, unknown> | null;

  @Column({
    name: 'plus_code',
    type: String,
    length: 50,
    nullable: true,
  })
  plusCode: string | null;

  @Column({
    name: 'target_tons',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  targetTons: string | null;

  @Column({
    name: 'current_tons',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  currentTons: string;

  @Column({
    type: String,
    length: 20,
    default: 'active',
  })
  status: string;

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

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
  })
  deletedAt: Date | null;
}
