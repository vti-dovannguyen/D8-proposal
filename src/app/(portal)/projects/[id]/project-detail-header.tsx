import Link from "next/link";

export function ProjectDetailHeader({ project }: {
  project: { name: string; code: string; category: string; section: string; active: boolean; description: string };
}) {
  return (
    <div className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-5 shadow-[var(--sh-1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{project.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {project.code && <span className="portal-pill bg-slate-100 text-slate-600">{project.code}</span>}
            <span className="portal-pill bg-blue-50 text-blue-700">{project.category}</span>
            <span className="portal-pill bg-slate-100 text-slate-600">{project.section}</span>
            <span className={"portal-pill " + (project.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{project.active ? "Active" : "Inactive"}</span>
          </div>
        </div>
        <Link href="/projects" className="shrink-0 rounded-lg border px-3 py-1.5 text-sm text-slate-600">← Projects</Link>
      </div>
      {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
    </div>
  );
}
