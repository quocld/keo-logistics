import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { HarvestAreaEntity } from './harvest-area.entity';
import { HarvestAreaCostCategoryEnum } from '../../../../domain/harvest-area-cost-category.enum';

@Entity({
  name: 'harvest_area_cost_entries',
})
export class HarvestAreaCostEntryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => HarvestAreaEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'harvest_area_id',
  })
  harvestArea: HarvestAreaEntity;

  @Column({
    type: String,
    length: 20,
  })
  category: HarvestAreaCostCategoryEnum;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  amount: string;

  @Column({
    name: 'incurred_at',
    type: 'timestamptz',
  })
  incurredAt: Date;

  @Column({
    type: 'text',
    nullable: true,
  })
  notes: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'created_by',
  })
  createdBy: UserEntity | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
