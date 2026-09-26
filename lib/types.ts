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
  clickCount?: number;
  lastOpenedAt?: string;
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
  isSpecificTitle?: boolean;
}

export type ViewMode = 'grid' | 'list';

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'mru'
  | 'most-used'
  | 'least-used';

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

export interface FixedClass {
  id: string;
  userId?: string;
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location?: string | null;
  color?: string;    // e.g. "indigo", "violet", "emerald", "amber", "rose", "sky"
  category?: string;
  createdAt?: string;
}
export type FixedEvent = FixedClass;

export type DeadlineStatus = 'not_started' | 'in_progress' | 'done';
export type PriorityLevel = 'high' | 'medium' | 'low';
export type TodoPriority = PriorityLevel;

export interface Deadline {
  id: string;
  userId?: string;
  title: string;
  description?: string | null;
  dueDate: string;    // "YYYY-MM-DD"
  dueTime?: string | null; // "HH:MM"
  category?: string | null; // Subject or category
  status?: DeadlineStatus;
  priority: PriorityLevel;
  estimatedDuration?: number; // minutes
  // compatibility fields
  completed?: boolean;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export type TodoItem = Deadline;

export type ScheduleBlockType = 'class' | 'study' | 'task' | 'break' | 'free' | 'fixed' | 'todo' | 'routine' | 'meal';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type BlockStatus = 'planned' | 'completed' | 'skipped';

export interface ScheduleBlockItem {
  id: string;
  userId?: string;
  date?: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  title: string;
  type: ScheduleBlockType;
  linkedDeadlineId?: string | null;
  todoId?: string;    // compatibility alias for linkedDeadlineId
  energyLevelRequired?: EnergyLevel | null;
  status?: BlockStatus;
  category?: string;
  priority?: PriorityLevel;
  reason?: string;
  isCompleted?: boolean;
  isSkipped?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export type ScheduleBlock = ScheduleBlockItem;

export interface EnergyLog {
  id: string;
  userId?: string;
  date: string;       // "YYYY-MM-DD"
  timeBlock: string;  // "09:00-10:00" or start time
  energyLevel: EnergyLevel;
  derivedScore?: number | null;
  createdAt?: string;
}

export interface StreakRecord {
  id: string;
  userId?: string;
  streakType: 'daily_adherence' | 'category';
  category?: string | null;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string | null;
  updatedAt?: string;
}

export interface ParsedCandidateItem {
  id: string;
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  location?: string;
  color?: string;
  type: 'class' | 'task';
  category?: string;
  selected: boolean;
}

export interface ScheduleConflict {
  event1: FixedClass;
  event2: FixedClass;
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
  blocks: ScheduleBlockItem[];
  summary?: string;
  conflicts?: ScheduleConflict[];
  createdAt?: string;
}

export interface ScheduleCompletion {
  id: string;
  userId?: string;
  scheduleId?: string;
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
  categoryStreaks?: Record<string, number>;
}



