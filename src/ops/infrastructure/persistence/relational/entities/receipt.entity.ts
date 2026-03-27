import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './harvest-area.entity';
import { WeighingStationEntity } from './weighing-station.entity';
import { TripEntity } from './trip.entity';
import { ReceiptStatusEnum } from '../../../../domain/receipt-status.enum';

@Entity({
  name: 'receipts',
})
@Index('idx_receipts_driver_status', ['driver', 'status'])
@Index('idx_receipts_area_status', ['harvestArea', 'status'])
@Index('idx_receipts_weighing_status', ['weighingStation', 'status'])
export class ReceiptEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TripEntity, { nullable: true })
  @JoinColumn({ name: 'trip_id' })
  trip: TripEntity | null;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'driver_id' })
  driver: UserEntity;

  @ManyToOne(() => HarvestAreaEntity, { nullable: false })
  @JoinColumn({ name: 'harvest_area_id' })
  harvestArea: HarvestAreaEntity;

  @ManyToOne(() => WeighingStationEntity, { nullable: true })
  @JoinColumn({ name: 'weighing_station_id' })
  weighingStation: WeighingStationEntity | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
  })
  weight: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  amount: string;

  @Column({
    name: 'receipt_date',
    type: 'timestamptz',
  })
  receiptDate: Date;

  @Column({
    name: 'bill_code',
    type: String,
    length: 50,
    nullable: true,
  })
  billCode: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @Column({
    type: String,
    length: 20,
    default: ReceiptStatusEnum.pending,
  })
  status: ReceiptStatusEnum;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  submittedAt: Date;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: UserEntity | null;

  @Column({
    name: 'approved_at',
    type: 'timestamptz',
    nullable: true,
  })
  approvedAt: Date | null;

  @Column({
    name: 'rejected_reason',
    type: 'text',
    nullable: true,
  })
  rejectedReason: string | null;

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
