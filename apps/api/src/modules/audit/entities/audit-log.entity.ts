import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column('uuid')
  tenantId: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  entityType: string | null;

  @Column('uuid', { nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any> | null;

  @Column({ nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
