import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  OrganizationRole,
  OrganizationStatus,
  PrismaClient,
  UserStatus,
} from '../src/generated/prisma/client';

config({ path: '../../.env' });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing from the root .env file.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const user = await prisma.user.upsert({
      where: {
        email: 'demo@contexto.dev',
      },
      update: {
        name: 'Demo Admin',
        status: UserStatus.ACTIVE,
      },
      create: {
        email: 'demo@contexto.dev',
        name: 'Demo Admin',
        status: UserStatus.ACTIVE,
      },
    });

    const organization = await prisma.organization.upsert({
      where: {
        slug: 'demo-company',
      },
      update: {
        name: 'Demo Company',
        status: OrganizationStatus.ACTIVE,
      },
      create: {
        name: 'Demo Company',
        slug: 'demo-company',
        status: OrganizationStatus.ACTIVE,
      },
    });

    const membership = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: {
        role: OrganizationRole.ADMIN,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: OrganizationRole.ADMIN,
      },
    });

    const workspace = await prisma.workspace.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'company-knowledge-base',
        },
      },
      update: {
        name: 'Company Knowledge Base',
        description: 'Default workspace for uploaded company documents.',
        createdByUserId: user.id,
      },
      create: {
        organizationId: organization.id,
        createdByUserId: user.id,
        name: 'Company Knowledge Base',
        slug: 'company-knowledge-base',
        description: 'Default workspace for uploaded company documents.',
      },
    });

    console.log('\nSeed completed successfully.\n');

    console.table({
      userId: user.id,
      organizationId: organization.id,
      membershipId: membership.id,
      workspaceId: workspace.id,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:\n', error);
  process.exit(1);
});
