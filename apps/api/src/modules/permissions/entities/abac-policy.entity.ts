import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('abac_policies')
export class AbacPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('uuid')
  tenantId: string;

  @Column()
  entityType: string;

  @Column()
  action: string;

  @Column({ default: 'allow' })
  effect: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', default: {} })
  conditions: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
