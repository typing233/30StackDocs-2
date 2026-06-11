import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

interface AuditLogEntry {
  userId: string | null;
  tenantId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, any> | null;
  ip: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  log(entry: AuditLogEntry): void {
    const auditLog = this.auditRepo.create(entry);
    this.auditRepo.save(auditLog).catch(() => {});
  }

  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { tenantId, entityType, entityId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findByUser(tenantId: string, userId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
