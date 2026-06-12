import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiTokensService } from './api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import { ApiToken } from './entities/api-token.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiToken, IdempotencyKey])],
  providers: [ApiTokensService],
  controllers: [ApiTokensController],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
