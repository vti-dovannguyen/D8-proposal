export type FileTypeKey = "pdf" | "xls" | "doc" | "ppt" | "md" | "txt" | "csv" | "zip" | "image" | "file";

const EXT_TO_KEY: Record<string, FileTypeKey> = {
  pdf: "pdf",
  xlsx: "xls", xls: "xls", xlsm: "xls",
  docx: "doc", doc: "doc",
  pptx: "ppt", ppt: "ppt",
  md: "md", markdown: "md",
  txt: "txt",
  csv: "csv",
  zip: "zip", rar: "zip", "7z": "zip",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
};

const TONE: Record<FileTypeKey, string> = {
  pdf: "bg-rose-50 text-rose-700",
  xls: "bg-emerald-50 text-emerald-700",
  doc: "bg-blue-50 text-blue-700",
  ppt: "bg-orange-50 text-orange-700",
  md: "bg-violet-50 text-violet-700",
  txt: "bg-slate-100 text-slate-600",
  csv: "bg-teal-50 text-teal-700",
  zip: "bg-amber-50 text-amber-700",
  image: "bg-fuchsia-50 text-fuchsia-700",
  file: "bg-slate-100 text-slate-600",
};

/** Map a file name to a display key (icon group), uppercase label, and Tailwind tone. Pure. */
export function fileTypeMeta(fileName: string): { key: FileTypeKey; label: string; tone: string } {
  const name = fileName ?? "";
  const dot = name.lastIndexOf(".");
  const ext = dot > -1 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
  const key = EXT_TO_KEY[ext] ?? "file";
  const label = ext ? ext.toUpperCase() : "FILE";
  return { key, label, tone: TONE[key] };
}
