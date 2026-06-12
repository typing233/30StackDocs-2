import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('system_config_history')
export class SystemConfigHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  configId: string;

  @Column('uuid', { nullable: true })
  tenantId: string | null;

  @Column()
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'jsonb', nullable: true })
  previousValue: any;

  @Column('uuid', { nullable: true })
  changedBy: string | null;

  @Column({ type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;
}
