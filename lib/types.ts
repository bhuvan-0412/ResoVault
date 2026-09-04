export interface Resource {
  id: string;
  userId?: string;
  url: string;
  title: string;
  category: string;
  tags: string[];
  description?: string;
  notes?: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface UrlMetadata {
  url: string;
  title: string;
  description: string;
  thumbnail?: string;
}

export type ViewMode = 'grid' | 'list';

export type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export interface CategoryStat {
  name: string;
  count: number;
}

