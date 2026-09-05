import { Controller, Get, Req } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  @Get('me')
  getMe(@Req() request: AuthenticatedRequest) {
    return {
      id: request.user.sub,
      email: request.user.email,
    };
  }
}
