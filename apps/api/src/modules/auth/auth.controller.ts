import { Controller, Post, Body, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService as SystemConfigService } from '../config/config.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const registrationEnabled = await this.systemConfigService.get<boolean>('site.registration.enabled', undefined);
    if (registrationEnabled === false) {
      throw new ForbiddenException('Registration is currently disabled');
    }
    return { data: await this.authService.register(dto) };
  }

  @Public()
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return { data: await this.authService.login(dto) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return { data: await this.authService.refresh(dto.refreshToken) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { data: { message: 'Logged out successfully' } };
  }
}
