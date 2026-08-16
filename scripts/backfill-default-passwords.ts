import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, DEFAULT_PASSWORD } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const hash = await hashPassword(DEFAULT_PASSWORD);
  const result = await db.user.updateMany({
    where: { password: null },
    data: { password: hash },
  });
  console.log(`✓ Backfilled default password for ${result.count} user(s).`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
