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

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  imageUrl?: string;
  sourceId?: string;
  sourceName?: string;
  sourceIcon?: string;
  category: string;
  categories?: string[];
  keywords?: string[];
  isBreaking?: boolean;
  readingTime?: number; // estimated minutes
  createdAt?: string;
}

export interface UserTopics {
  userId: string;
  topics: string[];
  customKeywords: string[];
  updatedAt?: string;
}

export interface ArticleClick {
  id: string;
  userId: string;
  articleId: string;
  category?: string;
  clickedAt: string;
}

export type AppTab = 'vault' | 'news' | 'schedule';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday...

export interface FixedEvent {
  id: string;
  userId?: string;
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  category?: string;
  createdAt?: string;
}

export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoItem {
  id: string;
  userId?: string;
  title: string;
  dueDate?: string | null;
  priority: TodoPriority;
  estimatedDuration: number; // minutes
  completed: boolean;
  completedAt?: string | null;
  category?: string;
  createdAt?: string;
}

export type ScheduleBlockType = 'fixed' | 'todo' | 'routine' | 'break' | 'meal';

export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  type: ScheduleBlockType;
  category?: string;
  todoId?: string;
  priority?: TodoPriority;
  reason?: string;
  isCompleted?: boolean;
  isSkipped?: boolean;
}

export interface ScheduleConflict {
  event1: FixedEvent;
  event2: FixedEvent;
  overlapMinutes: number;
  message: string;
}

export interface SchedulePreferences {
  wakeTime: string;      // "08:00"
  sleepTime: string;     // "23:30"
  peakEnergy: 'morning' | 'afternoon' | 'evening' | 'night';
  workoutPreference?: string;
  focusDuration: number; // minutes
  rawNotes?: string;
}

export interface GeneratedSchedule {
  id: string;
  userId?: string;
  scheduleDate: string; // "YYYY-MM-DD"
  blocks: ScheduleBlock[];
  summary?: string;
  conflicts?: ScheduleConflict[];
  createdAt?: string;
}

export interface ScheduleCompletion {
  id: string;
  userId?: string;
  scheduleId: string;
  blockId: string;
  date: string;
  status: 'completed' | 'skipped' | 'pending';
  timeSlot?: string;
  actionAt?: string;
}

export interface ScheduleStats {
  streakDays: number;
  dailyCompletionRate: number; // 0 - 100
  weeklyCompletionRate: number; // 0 - 100
  completedBlocksCount: number;
  totalBlocksCount: number;
}


