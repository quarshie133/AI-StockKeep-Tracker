import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Vercel's serverless filesystem is read-only outside /tmp, so the SQLite
// file bundled at prisma/dev.db cannot be opened for writing (or, in
// practice, reliably opened at all) in place. As a stopgap that keeps the
// app functional without a database migration, copy it into /tmp (the one
// writable path) on cold start and point Prisma there instead.
//
// This makes reads/writes work again, but /tmp is ephemeral: data can
// still be lost on a cold start or when a request lands on a different
// function instance. It is NOT a substitute for a real managed database.
// See Technical_Debt_Plan.pdf, TD-08, for the durable fix.
function resolveDatasourceUrl(): string | undefined {
  if (!process.env.VERCEL) return undefined;

  const dest = '/tmp/dev.db';
  try {
    if (!fs.existsSync(dest)) {
      const source = path.join(process.cwd(), 'prisma', 'dev.db');
      fs.copyFileSync(source, dest);
    }
    return `file:${dest}`;
  } catch (err) {
    console.error('Could not prepare a writable SQLite copy in /tmp (TD-08):', err);
    return undefined;
  }
}

const datasourceUrl = resolveDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
