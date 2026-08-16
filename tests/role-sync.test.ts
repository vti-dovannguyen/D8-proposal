// Imports Role directly from the generated enums file (not the full client) to
// avoid eagerly loading the database adapter/driver in the test environment.
import { describe, it, expect } from "vitest";
import { ROLES } from "@/types";
import type { AppRole } from "@/types";
import { Role as PrismaRole } from "@/generated/prisma/enums";

// Compile-time assertion: both directions must be assignable.
type _AppAssignableToPrisma = AppRole extends `${PrismaRole}` ? true : never;
type _PrismaAssignableToApp = `${PrismaRole}` extends AppRole ? true : never;
const _check1: _AppAssignableToPrisma = true;
const _check2: _PrismaAssignableToApp = true;
void _check1;
void _check2;

describe("Role enum sync", () => {
  it("app ROLES match the Prisma Role enum values", () => {
    const prismaValues = Object.values(PrismaRole).sort();
    expect([...ROLES].sort()).toEqual(prismaValues);
  });
});
