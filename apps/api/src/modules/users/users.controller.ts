import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return { data: await this.usersService.findByTenant(tenantId) };
  }

  @Get('me')
  async me(@CurrentUser() user: any) {
    const fullUser = await this.usersService.findById(user.id);
    return {
      data: {
        id: fullUser!.id,
        email: fullUser!.email,
        name: fullUser!.name,
        tenantId: fullUser!.tenantId,
        roles: fullUser!.roles.map((r) => r.name),
      },
    };
  }
}
