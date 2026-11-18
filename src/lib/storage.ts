/**
 * 前端 localStorage 封装（施工蓝图 §1.5 无数据库架构）
 * readingTrail / journalCats / decisionHistory 全部存浏览器。
 * 注意：OAuth token 严禁写入此处，只走 HttpOnly Cookie。
 */
"use client";

import type { JournalEntry, ReadingTrailItem, ZhihuItem } from "@/types";

const K_TRAIL = "fr.readingTrail";
const K_JOURNAL = "fr.journalCats";

const MAX_TRAIL = 5;

function read<T>(key: string, dflt: T): T {
  if (typeof window === "undefined") return dflt;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : dflt;
  } catch {
    return dflt;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式或配额满，静默忽略，不影响主流程 */
  }
}

/* ---------------- 静默浏览轨迹 ---------------- */

export function getTrail(): ReadingTrailItem[] {
  return read<ReadingTrailItem[]>(K_TRAIL, []);
}

export function pushTrail(item: ZhihuItem, fromQuestion?: string): ReadingTrailItem[] {
  const trail = getTrail().filter((t) => t.url !== item.url);
  trail.push({
    id: item.id,
    title: item.title,
    // 控制体积，避免 localStorage 爆配额；正文足够支撑原文引用校验
    contentText: item.contentText.slice(0, 1500),
    url: item.url,
    author: item.author,
    authoritylevel: item.authoritylevel,
    voteUpCount: item.voteUpCount,
    comments: item.comments.slice(0, 4),
    fromQuestion,
    readAt: Date.now(),
  });
  const next = trail.slice(-MAX_TRAIL);
  write(K_TRAIL, next);
  return next;
}

export function clearTrail(): void {
  write(K_TRAIL, []);
}

/* ---------------- 清醒猫咖手账 ---------------- */

export function getJournal(): JournalEntry[] {
  return read<JournalEntry[]>(K_JOURNAL, []);
}

export function addJournal(entry: Omit<JournalEntry, "id" | "createdAt">): JournalEntry[] {
  const list = getJournal();
  const next = [
    { ...entry, id: `j_${Date.now()}`, createdAt: Date.now() },
    ...list,
  ].slice(0, 50);
  write(K_JOURNAL, next);
  return next;
}
