import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'weighing_stations',
})
export class WeighingStationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: String,
    length: 150,
  })
  name: string;

  @Column({
    type: String,
    length: 50,
    unique: true,
    nullable: true,
  })
  code: string | null;

  @Column({
    name: 'google_place_id',
    type: String,
    length: 100,
    nullable: true,
  })
  googlePlaceId: string | null;

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
    name: 'formatted_address',
    type: 'text',
  })
  formattedAddress: string;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  unitPrice: string;

  @Column({
    type: String,
    length: 20,
    default: 'active',
  })
  status: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

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
