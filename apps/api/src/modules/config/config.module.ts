import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigHistory } from './entities/system-config-history.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfig, SystemConfigHistory]),
    MulterModule.register({ storage: undefined }),
    AuditModule,
  ],
  providers: [ConfigService],
  controllers: [ConfigController],
  exports: [ConfigService],
})
export class SystemConfigModule {}
