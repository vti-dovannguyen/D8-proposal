export type RawUserRow = Record<string, unknown>;
export type NormalizedUserRow = {
  email: string;
  name: string;
  dateOfBirth: Date | null;
  gender: string | null;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function normGender(v: unknown): string | null {
  const g = str(v).toLowerCase();
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return null;
}

function normDob(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeUserImportRows(
  rawRows: RawUserRow[],
  domain: string,
): { rows: NormalizedUserRow[]; errors: string[] } {
  const errors: string[] = [];
  const byEmail = new Map<string, NormalizedUserRow>();
  rawRows.forEach((raw, i) => {
    const lineNo = i + 2; // sheet header is row 1
    const name = str(raw["Name"]);
    const account = str(raw["Account"]).toLowerCase();
    if (!name || !account) {
      errors.push(`Bỏ qua dòng ${lineNo}: thiếu Name hoặc Account`);
      return;
    }
    const email = account.includes("@") ? account : `${account}@${domain}`;
    if (byEmail.has(email)) errors.push(`Trùng email trong file: ${email} (dùng dòng cuối)`);
    byEmail.set(email, {
      email,
      name,
      dateOfBirth: normDob(raw["Date of Birth"]),
      gender: normGender(raw["Gender"]),
    });
  });
  return { rows: [...byEmail.values()], errors };
}
