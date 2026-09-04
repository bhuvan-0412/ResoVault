'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Clock,
  ExternalLink,
  Bookmark,
  Sparkles,
  Sliders,
  RefreshCw,
  Check,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';
import { NewsArticle, Resource } from '@/lib/types';
import { TopicCustomizerModal } from './TopicCustomizerModal';

interface NewsDigestTabProps {
  onSaveToVault: (article: NewsArticle) => Promise<void>;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  searchQuery?: string;
}

function timeAgo(dateString?: string): string {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const NewsDigestTab: React.FC<NewsDigestTabProps> = ({
  onSaveToVault,
  isAuthenticated,
  onRequireAuth,
  searchQuery,
}) => {
  const [breakingArticles, setBreakingArticles] = useState<NewsArticle[]>([]);
  const [digestArticles, setDigestArticles] = useState<NewsArticle[]>([]);
  const [userTopics, setUserTopics] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  // Fetch curated digest
  const fetchDigest = async () => {
    setLoading(true);
    try {
      const [digestRes, topicsRes] = await Promise.all([
        fetch('/api/news/digest'),
        isAuthenticated ? fetch('/api/news/topics') : Promise.resolve(null),
      ]);

      if (digestRes.ok) {
        const data = await digestRes.json();
        setBreakingArticles(data.breaking || []);
        setDigestArticles(data.digest || []);
      }

      if (topicsRes && topicsRes.ok) {
        const topicsData = await topicsRes.json();
        setUserTopics(topicsData.topics || []);
        setCustomKeywords(topicsData.customKeywords || []);
      }
    } catch (err) {
      console.error('Failed to load news digest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDigest();
  }, [isAuthenticated]);

  // Track user article click for engagement weighting
  const handleArticleClick = (article: NewsArticle) => {
    if (!isAuthenticated) return;
    fetch('/api/news/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        category: article.category,
      }),
    }).catch(console.warn);
  };

  // Save article directly into ResoVault resources
  const handleSaveArticle = async (article: NewsArticle) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setSavingId(article.id);
    try {
      await onSaveToVault(article);
      setSavedArticleIds((prev) => new Set(prev).add(article.id));
    } catch (err) {
      console.error('Failed to save article to vault:', err);
    } finally {
      setSavingId(null);
    }
  };

  // Unique categories for filter chips
  const filterCategories = useMemo(() => {
    const set = new Set<string>();
    digestArticles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ['All', ...Array.from(set)];
  }, [digestArticles]);

  // Filtered digest articles
  const filteredDigest = useMemo(() => {
    let list = digestArticles;
    if (activeTopicFilter !== 'All') {
      list = list.filter((a) => a.category === activeTopicFilter);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q) ||
          (a.sourceName || '').toLowerCase().includes(q) ||
          a.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }
    return list;
  }, [digestArticles, activeTopicFilter, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Digest Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Today&apos;s Curated Digest</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Personalized Set • {digestArticles.length} Stories
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Curated 6-hour digest tailored to your interests and engagement history. No endless scrolling.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-all cursor-pointer"
            title="Customize your topics and keyword filters"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Customize Topics</span>
          </button>

          <button
            onClick={fetchDigest}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh daily digest"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. BREAKING & HIGH-PRIORITY NEWS SECTION */}
      {breakingArticles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-wide uppercase">
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Breaking &amp; Urgent Updates</span>
            </div>
            <span className="text-[11px] text-zinc-500">High-signal stories from the past 6 hours</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {breakingArticles.map((article) => {
              const isSaved = savedArticleIds.has(article.id);
              const isSaving = savingId === article.id;

              return (
                <div
                  key={article.id}
                  className="bg-gradient-to-br from-rose-950/20 via-zinc-900 to-zinc-900/90 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {article.sourceIcon ? (
                          <img
                            src={article.sourceIcon}
                            alt=""
                            className="w-4 h-4 rounded-full object-contain bg-zinc-800"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span className="text-xs font-semibold text-zinc-400">{article.sourceName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white tracking-wide uppercase shadow-sm">
                        Breaking
                      </span>
                    </div>

                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleArticleClick(article)}
                      className="block group-hover:text-rose-200 transition-colors"
                    >
                      <h3 className="text-base font-bold text-zinc-100 leading-snug line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-4">
                        {article.description}
                      </p>
                    </a>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {timeAgo(article.pubDate)}
                      </span>
                      <span>•</span>
                      <span>{article.readingTime || 2} min read</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveArticle(article)}
                        disabled={isSaving || isSaved}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSaved
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
                        }`}
                        title="Save article link to your ResoVault"
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3 h-3 text-indigo-400" />
                            <span>Save to Vault</span>
                          </>
                        )}
                      </button>

                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleArticleClick(article)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="Open full article in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TOPIC FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTopicFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTopicFilter === cat
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. CURATED DAILY DIGEST GRID */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Curating your personalized daily digest...</p>
        </div>
      ) : filteredDigest.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDigest.map((article) => {
            const isSaved = savedArticleIds.has(article.id);
            const isSaving = savingId === article.id;

            return (
              <div
                key={article.id}
                className="bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Source & Category Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {article.sourceIcon ? (
                        <img
                          src={article.sourceIcon}
                          alt=""
                          className="w-4 h-4 rounded-full object-contain shrink-0 bg-zinc-800"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-zinc-400 truncate">
                        {article.sourceName}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-indigo-300 border border-zinc-700/50 shrink-0">
                      {article.category}
                    </span>
                  </div>

                  {/* Headline & Snippet */}
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleArticleClick(article)}
                    className="block group-hover:text-indigo-200 transition-colors mb-3"
                  >
                    <h3 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-2 mb-1.5">
                      {article.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {article.description}
                    </p>
                  </a>
                </div>

                {/* Footer Meta & Actions */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 mt-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Clock className="w-3 h-3" />
                      {timeAgo(article.pubDate)}
                    </span>
                    <span>•</span>
                    <span>{article.readingTime || 2}m</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSaveArticle(article)}
                      disabled={isSaving || isSaved}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
                      }`}
                      title="Save article to your ResoVault links"
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3 h-3 text-indigo-400" />
                          <span>Save</span>
                        </>
                      )}
                    </button>

                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleArticleClick(article)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Open article in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 max-w-md mx-auto">
          <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-zinc-200 mb-1">No articles in this digest topic</h4>
          <p className="text-xs text-zinc-400 mb-4">
            Try switching filter chips or customizing your topics to include more domains.
          </p>
          <button
            onClick={() => setActiveTopicFilter('All')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Show All Topics
          </button>
        </div>
      )}

      {/* Topic Customizer Modal */}
      <TopicCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        currentTopics={userTopics}
        currentKeywords={customKeywords}
        onSaved={(newTopics, newKeywords) => {
          setUserTopics(newTopics);
          setCustomKeywords(newKeywords);
          fetchDigest();
        }}
        isAuthenticated={isAuthenticated}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
};
