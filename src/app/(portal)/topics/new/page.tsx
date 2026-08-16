import { db } from "@/lib/db";
import { getCategoryValues } from "@/lib/master-data-db";
import type { TopicFormData } from "@/types/community";
import { createTopic } from "../actions";
import { TopicForm } from "../topic-form";

export default async function NewTopicPage() {
  const [projects, categories] = await Promise.all([
    db.project.findMany({
      where: { active: true },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true },
    }),
    getCategoryValues("TOPIC"),
  ]);

  async function action(data: TopicFormData) {
    "use server";
    await createTopic(data);
  }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tạo chủ đề</h1>
          <p className="portal-page-subtitle">Tạo topic thảo luận theo danh mục và dự án liên quan.</p>
        </div>
      </div>
      <TopicForm projects={projects} categories={categories} onSubmit={action} />
    </div>
  );
}
