import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("escondidas123", 12);

  await prisma.user.upsert({
    where: { email: "mellow" },
    update: {},
    create: {
      name: "Mellow",
      email: "mellow",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
