import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { SearchService } from './search.service';

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequireScope('search')
  async search(
    @CurrentUser() user: any,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
    @Query('bookId') bookId?: string,
  ) {
    return this.searchService.search({
      query: query || '',
      tenantId: user.tenantId,
      userId: user.id,
      userRoles: user.roles || [],
      userRoleIds: user.roleIds || [],
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      entityTypes: types ? types.split(',') : undefined,
      bookId,
    });
  }

  @Post('reindex')
  @Roles('admin')
  @HttpCode(HttpStatus.ACCEPTED)
  async reindexAll(@CurrentUser() user: any) {
    this.searchService.reindexAll(user.tenantId).catch(() => {});
    return { message: 'Reindex started' };
  }
}
