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

@Entity({
  name: 'audit_logs',
})
export class AuditLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'table_name',
    type: String,
    length: 50,
  })
  tableName: string;

  @Column({
    name: 'record_id',
    type: 'uuid',
  })
  recordId: string;

  @Column({
    type: String,
    length: 20,
  })
  action: string;

  @Column({
    name: 'old_data',
    type: 'jsonb',
    nullable: true,
  })
  oldData: Record<string, unknown> | null;

  @Column({
    name: 'new_data',
    type: 'jsonb',
    nullable: true,
  })
  newData: Record<string, unknown> | null;

  @ManyToOne(() => UserEntity, {
    nullable: true,
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: UserEntity | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
