import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    event: string,
    userId?: string,
    context?: AuditContext,
    metadata?: Prisma.InputJsonObject,
  ) {
    try {
      return await this.prisma.auditEvent.create({
        data: {
          event,
          userId,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          metadata,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record audit event: ${event}`, error);
      return null;
    }
  }
}
