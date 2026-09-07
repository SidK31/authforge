import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AuthService } from './auth.service';
import { AccountTokenDto } from './dto/account-token.dto';
import { EmailAddressDto } from './dto/email-address.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenPasswordResetDto } from './dto/token-password-reset.dto';
import { Public } from './decorators/public.decorator';
import { AuthenticatedRequest } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountLifecycle: AccountLifecycleService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() input: RegisterDto, @Req() request: AuthenticatedRequest) {
    return this.authService.register(input, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() input: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.authService.login(input, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() input: RefreshTokenDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.refresh(input, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  logout(@Body() input: RefreshTokenDto, @Req() request: AuthenticatedRequest) {
    return this.authService.logout(input, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('request-email-verification')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  requestEmailVerification(
    @Body() input: EmailAddressDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountLifecycle.requestEmailVerification(input.email, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Body() input: AccountTokenDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountLifecycle.verifyEmail(input.token, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('request-password-reset')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(
    @Body() input: EmailAddressDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountLifecycle.requestPasswordReset(input.email, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() input: TokenPasswordResetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountLifecycle.resetPassword(input.token, input.newPassword, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('logout-all')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() request: AuthenticatedRequest) {
    return this.authService.logoutAll(request.user.sub, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
