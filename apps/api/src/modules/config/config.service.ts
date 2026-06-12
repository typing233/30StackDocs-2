import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigHistory } from './entities/system-config-history.entity';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';

const CONFIG_CACHE_PREFIX = 'config:';
const CONFIG_CACHE_TTL = 600; // 10 minutes
const CONFIG_CHANNEL = 'config:change';

export interface ConfigDefaults {
  'site.name': string;
  'site.logo': string;
  'site.public': boolean;
  'site.registration.enabled': boolean;
  'site.registration.defaultRole': string;
  'site.language': string;
  'site.theme': string;
  'export.maxConcurrent': number;
  'export.maxFileSize': number;
  'search.enabled': boolean;
  'search.minQueryLength': number;
  'auth.sessionTimeout': number;
  'auth.maxLoginAttempts': number;
}

const DEFAULT_CONFIG: Record<string, any> = {
  'site.name': 'StackDocs',
  'site.logo': '',
  'site.public': false,
  'site.registration.enabled': true,
  'site.registration.defaultRole': 'viewer',
  'site.language': 'zh-CN',
  'site.theme': 'light',
  'export.maxConcurrent': 3,
  'export.maxFileSize': 104857600,
  'search.enabled': true,
  'search.minQueryLength': 2,
  'auth.sessionTimeout': 900,
  'auth.maxLoginAttempts': 5,
};

@Injectable()
export class ConfigService {
  private localCache = new Map<string, any>();

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(SystemConfigHistory)
    private readonly historyRepo: Repository<SystemConfigHistory>,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
  ) {
    this.subscribeToChanges();
  }

  private subscribeToChanges() {
    this.redis.subscribe(CONFIG_CHANNEL, (message) => {
      const { tenantId, key } = JSON.parse(message);
      const cacheKey = this.getCacheKey(tenantId, key);
      this.localCache.delete(cacheKey);
    }).catch(() => {});
  }

  async get<T = any>(key: string, tenantId?: string): Promise<T> {
    const cacheKey = this.getCacheKey(tenantId || null, key);

    // Check local in-memory cache first
    if (this.localCache.has(cacheKey)) {
      return this.localCache.get(cacheKey);
    }

    // Check Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      const value = JSON.parse(cached);
      this.localCache.set(cacheKey, value);
      return value;
    }

    // Query database
    const config = await this.configRepo.findOne({
      where: { key, tenantId: tenantId || null as any },
    });

    const value = config ? config.value : (DEFAULT_CONFIG[key] ?? null);
    await this.redis.set(cacheKey, JSON.stringify(value), CONFIG_CACHE_TTL);
    this.localCache.set(cacheKey, value);
    return value;
  }

  async set(
    key: string,
    value: any,
    userId: string,
    tenantId?: string,
    reason?: string,
  ): Promise<SystemConfig> {
    let config = await this.configRepo.findOne({
      where: { key, tenantId: tenantId || null as any },
    });

    const previousValue = config?.value;

    if (config) {
      config.value = value;
      config.updatedBy = userId;
      config = await this.configRepo.save(config);
    } else {
      config = await this.configRepo.save(
        this.configRepo.create({
          key,
          value,
          tenantId: tenantId || null,
          updatedBy: userId,
        }),
      );
    }

    // Record history
    const lastHistory = await this.historyRepo.findOne({
      where: { configId: config.id },
      order: { version: 'DESC' },
    });

    await this.historyRepo.save(
      this.historyRepo.create({
        configId: config.id,
        tenantId: tenantId || null,
        key,
        value,
        previousValue,
        changedBy: userId,
        changeReason: reason || null,
        version: (lastHistory?.version || 0) + 1,
      }),
    );

    // Invalidate caches and notify cluster
    const cacheKey = this.getCacheKey(tenantId || null, key);
    this.localCache.delete(cacheKey);
    await this.redis.del(cacheKey);
    await this.redis.publish(CONFIG_CHANNEL, JSON.stringify({ tenantId, key }));

    // Audit log
    this.auditService.log({
      userId,
      tenantId: tenantId || 'global',
      action: 'config.update',
      entityType: 'system_config',
      entityId: config.id,
      changes: { key, value, previousValue },
      ip: null,
    });

    return config;
  }

  async getAll(tenantId?: string): Promise<Record<string, any>> {
    const configs = await this.configRepo.find({
      where: { tenantId: tenantId || null as any },
    });

    const result: Record<string, any> = { ...DEFAULT_CONFIG };
    for (const config of configs) {
      result[config.key] = config.value;
    }
    return result;
  }

  async getHistory(key: string, tenantId?: string, page = 1, limit = 20) {
    const config = await this.configRepo.findOne({
      where: { key, tenantId: tenantId || null as any },
    });
    if (!config) return { data: [], meta: { total: 0, page, limit } };

    const [items, total] = await this.historyRepo.findAndCount({
      where: { configId: config.id },
      order: { version: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: items, meta: { total, page, limit } };
  }

  async rollback(key: string, version: number, userId: string, tenantId?: string): Promise<SystemConfig> {
    const config = await this.configRepo.findOne({
      where: { key, tenantId: tenantId || null as any },
    });
    if (!config) throw new NotFoundException(`Config key "${key}" not found`);

    const historyEntry = await this.historyRepo.findOne({
      where: { configId: config.id, version },
    });
    if (!historyEntry) throw new NotFoundException(`Version ${version} not found for key "${key}"`);

    return this.set(key, historyEntry.value, userId, tenantId, `Rollback to version ${version}`);
  }

  async delete(key: string, tenantId?: string): Promise<void> {
    const config = await this.configRepo.findOne({
      where: { key, tenantId: tenantId || null as any },
    });
    if (!config) return;

    await this.configRepo.delete(config.id);
    const cacheKey = this.getCacheKey(tenantId || null, key);
    this.localCache.delete(cacheKey);
    await this.redis.del(cacheKey);
    await this.redis.publish(CONFIG_CHANNEL, JSON.stringify({ tenantId, key }));
  }

  async uploadLogo(tenantId: string, fileBuffer: Buffer, filename: string): Promise<string> {
    // Store logo as base64 in config for simplicity (production: use object storage)
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif' };
    const mime = mimeTypes[ext] || 'image/png';
    const dataUri = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    await this.set('site.logo', dataUri, 'system', tenantId);
    return dataUri;
  }

  private getCacheKey(tenantId: string | null, key: string): string {
    return `${CONFIG_CACHE_PREFIX}${tenantId || 'global'}:${key}`;
  }
}
