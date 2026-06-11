import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(name: string): Promise<Tenant> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tenant = this.tenantRepo.create({ name, slug });
    return this.tenantRepo.save(tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }
}
