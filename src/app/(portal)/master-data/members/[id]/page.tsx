import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSignedDownloadUrl } from "@/lib/storage";
import { MemberSkills } from "./member-skills";
import { MemberCertificates } from "./member-certificates";
import { MemberClassification } from "./member-classification";
import { EMPLOYEE_TYPE_LABELS, type EmployeeType } from "@/types";

function fmt(d: Date | null) { return d ? d.toISOString().slice(0, 10) : ""; }

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const user = await db.user.findUnique({
    where: { id },
    include: {
      userSkills: { include: { skill: true } },
      certificates: { include: { type: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();

  const [skillOptions, typeOptions] = await Promise.all([
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.certificateType.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const currentSkills = user.userSkills.map((us) => ({ id: us.id, skillId: us.skillId, name: us.skill.name, level: us.level }));
  const currentCerts = await Promise.all(
    user.certificates.map(async (c) => ({
      id: c.id, typeName: c.type.name, issuer: c.issuer ?? "", issuedAt: fmt(c.issuedAt), expiresAt: fmt(c.expiresAt), credentialId: c.credentialId ?? "",
      downloadUrl: c.fileUrl ? await getSignedDownloadUrl(c.fileUrl) : "",
    })),
  );

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">{user.name}</h1>
          <p className="portal-page-subtitle">
            {user.email}{user.section ? ` · ${user.section}` : ""} · {EMPLOYEE_TYPE_LABELS[user.employeeType as EmployeeType]}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MemberClassification userId={user.id} current={user.employeeType as EmployeeType} />
        <MemberSkills userId={user.id} current={currentSkills} options={skillOptions} />
        <MemberCertificates userId={user.id} current={currentCerts} options={typeOptions} />
      </div>
    </div>
  );
}
