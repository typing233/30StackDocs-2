import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from './config.service';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // Public endpoint must be declared before :key to avoid being swallowed by the wildcard
  @Public()
  @Get('public/site')
  async getPublicSiteConfig() {
    const [siteName, siteLogo, sitePublic, registrationEnabled, language, theme] = await Promise.all([
      this.configService.get('site.name', undefined),
      this.configService.get('site.logo', undefined),
      this.configService.get('site.public', undefined),
      this.configService.get('site.registration.enabled', undefined),
      this.configService.get('site.language', undefined),
      this.configService.get('site.theme', undefined),
    ]);

    return {
      data: {
        name: siteName,
        logo: siteLogo,
        public: sitePublic,
        registrationEnabled,
        language,
        theme,
      },
    };
  }

  @Get()
  @Roles('admin')
  async getAll(@CurrentUser() user: any) {
    const configs = await this.configService.getAll(user.tenantId);
    return { data: configs };
  }

  @Get(':key')
  async getByKey(@CurrentUser() user: any, @Param('key') key: string) {
    const value = await this.configService.get(key, user.tenantId);
    return { data: { key, value } };
  }

  @Put(':key')
  @Roles('admin')
  async setConfig(
    @CurrentUser() user: any,
    @Param('key') key: string,
    @Body() body: { value: any; reason?: string },
  ) {
    if (body.value === undefined) {
      throw new BadRequestException('Value is required');
    }
    const config = await this.configService.set(key, body.value, user.id, user.tenantId, body.reason);
    return { data: config };
  }

  @Delete(':key')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@CurrentUser() user: any, @Param('key') key: string) {
    await this.configService.delete(key, user.tenantId);
  }

  @Get(':key/history')
  @Roles('admin')
  async getHistory(
    @CurrentUser() user: any,
    @Param('key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.configService.getHistory(
      key,
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':key/rollback')
  @Roles('admin')
  async rollback(
    @CurrentUser() user: any,
    @Param('key') key: string,
    @Body() body: { version: number },
  ) {
    if (!body.version) throw new BadRequestException('Version is required');
    const config = await this.configService.rollback(key, body.version, user.id, user.tenantId);
    return { data: config };
  }

  @Post('logo')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@CurrentUser() user: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('File too large (max 2MB)');

    const allowedMimes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const url = await this.configService.uploadLogo(user.tenantId, file.buffer, file.originalname);
    return { data: { url } };
  }

}
