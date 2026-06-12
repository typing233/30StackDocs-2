import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column('uuid')
  tenantId: string;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ type: 'jsonb', default: [] })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;
}
