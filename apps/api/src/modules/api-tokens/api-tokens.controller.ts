import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTokensService } from './api-tokens.service';

@Controller('api/tokens')
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Post()
  async createToken(
    @CurrentUser() user: any,
    @Body() body: {
      name: string;
      scopes: string[];
      expiresAt?: string;
      rateLimit?: number;
    },
  ) {
    const { token, apiToken } = await this.apiTokensService.createToken(
      user.id,
      user.tenantId,
      body.name,
      body.scopes,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
      body.rateLimit,
    );
    return {
      data: {
        ...apiToken,
        token, // Only returned on creation
      },
    };
  }

  @Get()
  async listTokens(@CurrentUser() user: any) {
    const tokens = await this.apiTokensService.listTokens(user.id, user.tenantId);
    return { data: tokens };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeToken(@CurrentUser() user: any, @Param('id') id: string) {
    await this.apiTokensService.revokeToken(id, user.id, user.tenantId);
  }
}
