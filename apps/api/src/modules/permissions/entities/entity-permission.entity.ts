import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('entity_permissions')
export class EntityPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column('uuid')
  entityId: string;

  @Column('uuid', { nullable: true })
  roleId: string | null;

  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column()
  action: string;

  @Column('uuid')
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;
}
