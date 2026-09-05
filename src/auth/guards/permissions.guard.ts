import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('Permission denied');
    }

    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    const permissions = new Set(
      assignments.flatMap((assignment) =>
        assignment.role.permissions.map((item) => item.permission.name),
      ),
    );

    const hasAllPermissions = requiredPermissions.every((permission) =>
      permissions.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Permission denied');
    }

    return true;
  }
}
