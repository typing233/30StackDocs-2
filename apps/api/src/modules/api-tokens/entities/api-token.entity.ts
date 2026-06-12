import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('api_tokens')
export class ApiToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  tokenHash: string;

  @Column({ length: 12 })
  tokenPrefix: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ type: 'jsonb', default: [] })
  scopes: string[];

  @Column({ type: 'int', default: 60 })
  rateLimit: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
