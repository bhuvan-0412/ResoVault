export interface Resource {
  id: string;
  url: string;
  title: string;
  category: string;
  tags: string[];
  notes?: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'grid' | 'list';

export type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export interface CategoryStat {
  name: string;
  count: number;
}
