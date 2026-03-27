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
import { HarvestAreaStatusEnum } from '../../../../domain/harvest-area-status.enum';

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

  /** Diện tích bãi (ha). */
  @Column({
    name: 'area_hectares',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  areaHectares: string | null;

  /** Số tấn dự kiến khai thác (kế hoạch). */
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
    default: HarvestAreaStatusEnum.active,
  })
  status: HarvestAreaStatusEnum;

  /** Liên hệ phía chủ đất / chủ bãi (khác user owner trong hệ thống). */
  @Column({
    name: 'site_contact_name',
    type: String,
    length: 150,
    nullable: true,
  })
  siteContactName: string | null;

  @Column({
    name: 'site_contact_phone',
    type: String,
    length: 30,
    nullable: true,
  })
  siteContactPhone: string | null;

  @Column({
    name: 'site_contact_email',
    type: String,
    length: 255,
    nullable: true,
  })
  siteContactEmail: string | null;

  /** Ngày mua/thuê cây tại bãi (lần gần nhất hoặc lần đầu — ghi chú thêm ở siteNotes). */
  @Column({
    name: 'site_purchase_date',
    type: 'date',
    nullable: true,
  })
  sitePurchaseDate: string | null;

  /** Ví dụ: chu kỳ mua lại cây sau 2–3 năm. */
  @Column({
    name: 'site_notes',
    type: 'text',
    nullable: true,
  })
  siteNotes: string | null;

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
