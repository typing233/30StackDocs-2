import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiToken } from './entities/api-token.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiTokensService {
  constructor(
    @InjectRepository(ApiToken)
    private readonly tokenRepo: Repository<ApiToken>,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    private readonly redis: RedisService,
  ) {}

  async createToken(
    userId: string,
    tenantId: string,
    name: string,
    scopes: string[],
    expiresAt?: Date,
    rateLimit = 60,
  ): Promise<{ token: string; apiToken: ApiToken }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 8);

    const apiToken = this.tokenRepo.create({
      name,
      tokenHash,
      tokenPrefix,
      userId,
      tenantId,
      scopes,
      rateLimit,
      expiresAt: expiresAt || null,
    });

    const saved = await this.tokenRepo.save(apiToken);
    return { token: `sd_${rawToken}`, apiToken: saved };
  }

  async validateToken(rawToken: string): Promise<{ userId: string; tenantId: string; scopes: string[]; tokenId: string }> {
    const tokenValue = rawToken.startsWith('sd_') ? rawToken.slice(3) : rawToken;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    const apiToken = await this.tokenRepo.findOne({ where: { tokenHash } });
    if (!apiToken) throw new UnauthorizedException('Invalid API token');
    if (apiToken.revokedAt) throw new UnauthorizedException('Token revoked');
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) throw new UnauthorizedException('Token expired');

    // Update last used
    this.tokenRepo.update(apiToken.id, { lastUsedAt: new Date() }).catch(() => {});

    return {
      userId: apiToken.userId,
      tenantId: apiToken.tenantId,
      scopes: apiToken.scopes,
      tokenId: apiToken.id,
    };
  }

  checkScope(tokenScopes: string[], requiredScope: string): void {
    if (tokenScopes.includes('admin')) return;
    if (!tokenScopes.includes(requiredScope)) {
      throw new ForbiddenException(`Token lacks required scope: ${requiredScope}`);
    }
  }

  async checkRateLimit(tokenId: string, rateLimit: number): Promise<boolean> {
    const key = `ratelimit:token:${tokenId}`;
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= rateLimit) return false;

    // Increment with TTL of 60 seconds
    await this.redis.set(key, String(count + 1), 60);
    return true;
  }

  async listTokens(userId: string, tenantId: string): Promise<ApiToken[]> {
    return this.tokenRepo.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      select: ['id', 'name', 'tokenPrefix', 'scopes', 'rateLimit', 'expiresAt', 'lastUsedAt', 'revokedAt', 'createdAt'],
    });
  }

  async revokeToken(id: string, userId: string, tenantId: string): Promise<void> {
    const token = await this.tokenRepo.findOne({ where: { id, userId, tenantId } });
    if (!token) throw new UnauthorizedException('Token not found');
    await this.tokenRepo.update(id, { revokedAt: new Date() });
  }

  // Idempotency key management
  async getIdempotencyResponse(key: string, tenantId: string): Promise<{ statusCode: number; body: any } | null> {
    const existing = await this.idempotencyRepo.findOne({
      where: { key, tenantId },
    });
    if (!existing) return null;
    if (existing.expiresAt < new Date()) {
      await this.idempotencyRepo.delete(existing.id);
      return null;
    }
    return { statusCode: existing.statusCode, body: existing.responseBody };
  }

  async storeIdempotencyResponse(
    key: string,
    tenantId: string,
    method: string,
    path: string,
    statusCode: number,
    body: any,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await this.idempotencyRepo.save({
      key,
      tenantId,
      method,
      path,
      statusCode,
      responseBody: body,
      expiresAt,
    });
  }

  async cleanExpiredIdempotencyKeys(): Promise<void> {
    await this.idempotencyRepo
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < NOW()')
      .execute();
  }
}
