import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { ExportService } from './export.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/exports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  @RequireScope('export')
  @HttpCode(HttpStatus.ACCEPTED)
  async createExport(
    @CurrentUser() user: any,
    @Body() body: {
      format: string;
      entityType: string;
      entityId: string;
      options?: Record<string, any>;
    },
  ) {
    const job = await this.exportService.createExportJob(
      user.id,
      user.tenantId,
      user.roles || [],
      body.format,
      body.entityType,
      body.entityId,
      body.options,
    );
    return { data: job };
  }

  @Get()
  async listExports(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exportService.listJobs(
      user.tenantId,
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  async getExportStatus(@CurrentUser() user: any, @Param('id') id: string) {
    const job = await this.exportService.getJobStatus(id, user.tenantId, user.id);
    return { data: job };
  }

  @Get(':id/download')
  async downloadExport(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const filePath = await this.exportService.getFilePath(id, user.tenantId, user.id);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Export file not found');
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.pdf': 'application/pdf',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelExport(@CurrentUser() user: any, @Param('id') id: string) {
    await this.exportService.cancelJob(id, user.tenantId, user.id);
  }
}
