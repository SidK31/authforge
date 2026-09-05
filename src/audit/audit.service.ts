import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    event: string,
    userId?: string,
    context?: AuditContext,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        event,
        userId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata,
      },
    });
  }
}
