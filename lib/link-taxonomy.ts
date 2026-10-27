// Single source of truth for how Vault links are organized: 11 folders, type tags and topic tags.
//
// Tag rule: every link gets exactly 1 TYPE tag + 1-3 TOPIC tags.
// Never use platform tags (drive, gdocs, youtube, ...): the site icon already shows the platform.

export interface FolderDef {
  name: string;
  description: string;
}

export const FOLDERS: readonly FolderDef[] = [
  {
    name: 'Content',
    description: 'scripting, hooks, storytelling, Instagram growth, branding, link-in-bio, creator inspiration',
  },
  { name: 'Video Editing', description: 'asset packs, SFX, textures, video editing tools' },
  { name: 'AI Tools & Prompts', description: 'AI tools, prompt docs, AI image/video generation' },
  { name: 'Design & Web', description: 'web design, animation libraries, templates, colors, icons, data viz' },
  { name: 'Dev & GitHub', description: 'repos, coding, ML/AI courses, dev tools' },
  { name: 'Product Management', description: 'PM guides, roadmaps, portfolios, casebooks, internships' },
  { name: 'Career & Roadmaps', description: 'non-PM roadmaps, resume, hackathons, career posts' },
  { name: 'Startups', description: 'startup essays, courses, playlists' },
  { name: 'Certificates', description: 'course certificates' },
  { name: 'Acads', description: 'college/academic folders' },
  { name: 'Personal', description: 'photos, personal stuff' },
];

export const FOLDER_NAMES: readonly string[] = FOLDERS.map((f) => f.name);

export const TYPE_TAGS = [
  'video', 'playlist', 'course', 'article', 'post', 'doc', 'pdf', 'image', 'prompt',
  'guide', 'template', 'tool', 'repo', 'folder', 'assets', 'inspiration', 'certificate', 'photos',
] as const;

export const TOPIC_TAGS = [
  'ai', 'ml', 'agents', 'automation', 'coding', 'github', 'dev', 'design', 'animation', 'react',
  'webgl', 'colors', 'icons', 'data-viz', 'vibe-coding', 'architecture', 'editing', 'video-gen',
  'image-gen', 'sfx', 'transitions', 'textures', 'screen-recording', 'scripting', 'hooks',
  'storytelling', 'reels', 'instagram', 'growth', 'branding', 'link-in-bio', 'carousel', 'workflow',
  'visuals', 'pm', 'internship', 'roadmap', 'portfolio', 'casebook', 'career', 'resume', 'hackathon',
  'startups', 'phoenix',
] as const;

export type TypeTag = (typeof TYPE_TAGS)[number];
export type TopicTag = (typeof TOPIC_TAGS)[number];

/** Tags that only describe the hosting platform. Never stored. */
export const PLATFORM_TAGS: ReadonlySet<string> = new Set([
  'drive', 'google-drive', 'gdocs', 'google-docs', 'gsheets', 'google-sheets', 'youtube',
  'linkedin', 'notion', 'simplilearn', 'dropbox',
]);

/** Marker tag for links whose title could not be fetched or is generic. */
export const NEEDS_REVIEW_TAG = 'needs-review';

const TAG_SYNONYMS: Record<string, string> = {
  'ai-tool': 'ai',
  'ai-tools': 'ai',
  hackathons: 'hackathon',
  'video-editing': 'editing',
  'personal-brand': 'branding',
  'image-generation': 'image-gen',
  'video-generation': 'video-gen',
};

const TYPE_SET: ReadonlySet<string> = new Set(TYPE_TAGS);
const TOPIC_SET: ReadonlySet<string> = new Set(TOPIC_TAGS);

export function isTypeTag(tag: string): boolean {
  return TYPE_SET.has(tag);
}

export function isTopicTag(tag: string): boolean {
  return TOPIC_SET.has(tag);
}

/** lowercase, spaces -> hyphens, strip leading #, merge synonyms. */
export function normalizeTag(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return TAG_SYNONYMS[cleaned] ?? cleaned;
}

/**
 * Applies the tag rule to a list of tags (typically AI output): normalizes, drops platform tags,
 * keeps at most one type tag and at most three topic tags. Unknown tags are dropped, except
 * `needs-review`, which is preserved.
 */
export function enforceTagRule(tags: readonly string[]): string[] {
  let type: string | null = null;
  const topics: string[] = [];
  let needsReview = false;

  for (const raw of tags) {
    const tag = normalizeTag(String(raw));
    if (!tag || PLATFORM_TAGS.has(tag)) continue;
    if (tag === NEEDS_REVIEW_TAG) needsReview = true;
    else if (isTypeTag(tag)) type = type ?? tag;
    else if (isTopicTag(tag) && !topics.includes(tag) && topics.length < 3) topics.push(tag);
  }

  const result = [...(type ? [type] : []), ...topics];
  if (needsReview) result.push(NEEDS_REVIEW_TAG);
  return result;
}

/** Returns the canonical folder name for a case-insensitive match, otherwise null. */
export function matchFolder(name: string | undefined | null): string | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  return FOLDER_NAMES.find((f) => f.toLowerCase() === lower) ?? null;
}

/** Prompt block describing the folders and tag rule, shared by every AI categorization call. */
export function buildTaxonomyPrompt(): string {
  const folders = FOLDERS.map((f) => `- "${f.name}": ${f.description}`).join('\n');
  return `FOLDERS (the "category" MUST be exactly one of these names):
${folders}

TAG RULE: every link gets exactly 1 TYPE tag + 1 to 3 TOPIC tags (2-4 tags total).
- TYPE tags (pick exactly 1): ${TYPE_TAGS.join(', ')}
- TOPIC tags (pick 1-3): ${TOPIC_TAGS.join(', ')}
- Use only tags from these lists. Never use platform tags such as drive, gdocs, gsheets, youtube, linkedin, notion or simplilearn; the site icon already shows the platform.`;
}

/** True when a fetched page title is empty, a sign-in/error page or otherwise unhelpful. */
export function isGenericTitle(title: string): boolean {
  if (!title || typeof title !== 'string') return true;
  const clean = title.trim();
  const lower = clean.toLowerCase();
  if (clean.length < 3) return true;

  const genericPatterns = [
    /^google drive:? ?sign[- ]?in.*$/i,
    /^google drive$/i,
    /^drive$/i,
    /^google docs$/i,
    /^google sheets$/i,
    /^google slides$/i,
    /^google forms$/i,
    /^google$/,
    /^google accounts$/i,
    /^sign[- ]?in.*$/i,
    /.*sign[- ]?in.*google/i,
    /^log[- ]?in.*$/i,
    /^sign[- ]?up.*$/i,
    /^dropbox$/i,
    /^dropbox.*sign[- ]?in/i,
    /^onedrive$/i,
    /^notion$/i,
    /^notion – the all-in-one workspace.*$/i,
    /^instagram$/i,
    /^login • instagram$/i,
    /^twitter$/i,
    /^x$/i,
    /^github$/i,
    /^youtube$/i,
    /^404.*$/i,
    /^page not found.*$/i,
    /^error.*$/i,
    /^internal server error.*$/i,
    /^access denied.*$/i,
    /^unauthorized.*$/i,
    /^forbidden.*$/i,
    /^security check.*$/i,
    /^just a moment\.\.\..*$/i,
    /^attention required.*$/i,
    /^redirecting.*$/i,
    /.*— review$/i,
    /^untitled.*$/i,
    /^home(page)?$/i,
    /^welcome$/i,
  ];

  for (const pat of genericPatterns) {
    if (pat.test(lower)) return true;
  }
  return false;
}
