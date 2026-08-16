"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function WikiEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content,
    immediatelyRender: false, // required for Next.js App Router SSR (avoids hydration mismatch)
    editorProps: { attributes: { class: "min-h-[240px] px-3 py-2 text-sm focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return null;
  return (
    <div className="rounded-xl border bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Btn({ active, onClick, label, aria }: { active: boolean; onClick: () => void; label: string; aria: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria} aria-pressed={active}
      className={"rounded px-2 py-1 text-xs " + (active ? "bg-slate-900 text-white" : "border")}>
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 border-b p-2">
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="B" aria="In đậm" />
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" aria="In nghiêng" />
      <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" aria="Tiêu đề cấp 2" />
      <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" aria="Tiêu đề cấp 3" />
      <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="• List" aria="Danh sách dấu đầu dòng" />
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1. List" aria="Danh sách đánh số" />
      <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="❝" aria="Trích dẫn" />
    </div>
  );
}
