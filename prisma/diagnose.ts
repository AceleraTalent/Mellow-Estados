import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, passwordHash: true },
  });

  console.log(`DIAG: total users = ${users.length}`);
  for (const u of users) {
    const matches = await bcrypt.compare("escondidas123", u.passwordHash);
    console.log(
      `DIAG: email="${u.email}" name="${u.name}" role=${u.role} active=${u.active} passwordMatchesEscondidas123=${matches}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("DIAG ERROR", error);
    await prisma.$disconnect();
    process.exit(1);
  });
