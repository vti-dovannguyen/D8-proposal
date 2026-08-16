export type TopicFormData = {
  title: string;
  content: string;
  category: string;
  project: string;
  tags: string; // comma-separated raw input
};

export type AnnouncementFormData = {
  title: string;
  body: string; // rich-text HTML
  pinned: boolean;
  active: boolean;
};

export type AgentFormData = {
  name: string;
  description: string;
  useCase: string;
  prompt: string;
  category: string;
};
