"use client";
import { useTransition } from "react";
import { updateUserRole } from "./actions";
import { ROLES } from "@/types";
import type { Role } from "@/types";

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={role}
      disabled={pending}
      onChange={(e) => start(() => updateUserRole(userId, e.target.value as Role))}
      className="rounded border px-2 py-1 text-sm"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
