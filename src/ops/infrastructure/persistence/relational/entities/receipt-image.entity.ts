import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ReceiptEntity } from './receipt.entity';

@Entity({
  name: 'receipt_images',
})
export class ReceiptImageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReceiptEntity, (r) => r.images, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'receipt_id',
  })
  receipt: ReceiptEntity;

  @Column({
    name: 'image_url',
    type: 'text',
  })
  imageUrl: string;

  @Column({
    name: 'is_primary',
    type: 'boolean',
    default: false,
  })
  isPrimary: boolean;

  @CreateDateColumn({
    name: 'uploaded_at',
    type: 'timestamptz',
  })
  uploadedAt: Date;
}
