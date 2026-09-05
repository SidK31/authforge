import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  { name: 'roles:read', description: 'List roles and their permissions' },
  { name: 'users:read', description: 'Read user profiles' },
];

const roles = [
  { name: 'user', description: 'Standard authenticated user' },
  { name: 'admin', description: 'Administrative user' },
];

async function main() {
  const permissionRecords = await Promise.all(
    permissions.map((permission) =>
      prisma.permission.upsert({
        where: { name: permission.name },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const roleRecords = await Promise.all(
    roles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description },
        create: role,
      }),
    ),
  );

  const adminRole = roleRecords.find((role) => role.name === 'admin');

  if (!adminRole) {
    throw new Error('Admin role was not created');
  }

  await Promise.all(
    permissionRecords.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
