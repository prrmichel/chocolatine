export type PromptCategory = 'PR Review' | 'Work Item changes summary';

export interface PromptTemplate {
  id: string;
  name: string;
  category?: PromptCategory;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptLibrarySettings {
  defaultPromptId?: string | null;
  defaultPromptIdByCategory?: Partial<Record<PromptCategory, string>>;
  prompts: PromptTemplate[];
}