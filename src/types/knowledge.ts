export type WikiFormData = {
  title: string;
  content: string; // HTML produced by the TinyMCE editor
  category: string;
  project: string;
  tags: string; // comma-separated raw input
};

export type SearchRow = {
  id: string;
  type: "document" | "wiki";
  title: string;
  category: string;
  rank: number;
};
