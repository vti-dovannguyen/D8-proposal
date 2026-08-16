export const MEETING_SECTIONS = ["D8", "D8.1", "D8.2", "D8.3"] as const;

export const MEETING_CATEGORIES = ["Weekly", "Monthly", "Risk Review", "Customer Escalation"] as const;

export const PROJECT_CATEGORIES = ["Delivery", "Maintenance", "Presales", "Internal"] as const;

export const WIKI_CATEGORIES = ["Project Guide", "Process", "Technical", "Customer", "Template", "Other"] as const;

export const DOCUMENT_CATEGORIES = ["Proposal", "Estimate", "Test Plan", "Checklist", "SOW", "Report", "Template", "Other"] as const;

export const TOPIC_CATEGORIES = ["Kỹ thuật", "Quản lý", "Quy trình", "Khách hàng", "Đề xuất", "Khác"] as const;

export const PROJECT_ROLES = ["Developer", "BrSE", "Tester", "QA", "BA", "PM", "Comtor", "Designer"] as const;

export const ENVIRONMENT_NAMES = ["T4", "Dev", "Staging", "Production"] as const;

/** Source-code hosting providers a project repo URL may point to. */
export const REPO_PROVIDERS = ["github", "gitlab"] as const;

/** Project management tools a project may be tracked in. */
export const PM_TOOLS = ["redmine", "backlog"] as const;

export type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
  category: string;
  section: string;
  // True when the project has PM tool + URL + token configured, so its weekly
  // tasks can be synced. Only the meeting form populates this; the token itself
  // is never sent to the client.
  pmConfigured?: boolean;
  // True when the project is tracked as multiple sub-projects — the Weekly
  // Report form then swaps the flat Milestone/Issues-Risks sections for a
  // per-sub-project group editor (see meeting-form.tsx#GroupsEditor).
  hasSubProjects?: boolean;
};
