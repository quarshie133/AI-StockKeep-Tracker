import { prisma } from '@/lib/prisma';

/**
 * Write an audit log entry to the database.
 * Non-blocking: errors are swallowed so they never crash a request.
 */
export function logAudit(
  action: string,
  role: 'user' | 'admin',
  entityId?: number,
  details?: Record<string, unknown> | string
) {
  const detailsStr =
    details === undefined
      ? undefined
      : typeof details === 'string'
        ? details
        : JSON.stringify(details);

  prisma.auditLog
    .create({ data: { action, role, entityId, details: detailsStr } })
    .catch((err) => console.error('[AuditLog] Failed to write:', err));
}

/**
 * Record a login event.
 */
export function logLoginEvent(role: 'user' | 'admin', success: boolean, ip?: string) {
  prisma.loginEvent
    .create({ data: { role, success, ip } })
    .catch((err) => console.error('[LoginEvent] Failed to write:', err));
}

/**
 * Check if the system is in read-only mode for users.
 */
export async function isUserReadOnly(): Promise<boolean> {
  try {
    const settings = await prisma.settings.findFirst({ select: { userReadOnly: true } });
    return settings?.userReadOnly ?? false;
  } catch {
    return false;
  }
}
