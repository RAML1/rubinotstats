/**
 * Utility functions for formatting numbers, dates, and other data types
 */

import {
  formatDistanceToNow,
  format,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
} from 'date-fns';
import { DEAL_SCORE } from './constants';
import type { DealScoreVariant } from './constants';

/**
 * Format large numbers with abbreviated suffixes (K, M, B)
 * @example formatNumber(1500000) -> "1.5M"
 * @example formatNumber(1500) -> "1.5K"
 */
export function formatNumber(num: number): string {
  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return `${sign}${(absNum / 1_000_000_000).toFixed(2)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${sign}${(absNum / 1_000_000).toFixed(2)}M`;
  }
  if (absNum >= 1_000) {
    return `${sign}${(absNum / 1_000).toFixed(2)}K`;
  }

  return `${sign}${Math.floor(absNum)}`;
}

/**
 * Format experience values with appropriate suffixes (K, M, B)
 * @example formatExp(1234567890) -> "1.23B"
 * @example formatExp(1234567n) -> "1.23M"
 */
export function formatExp(exp: number | bigint): string {
  const numExp = typeof exp === 'bigint' ? Number(exp) : exp;
  return formatNumber(numExp);
}

/**
 * Format price in game currency with TC suffix
 * @example formatPrice(15000) -> "15k TC"
 * @example formatPrice(1500000) -> "1.5M TC"
 */
export function formatPrice(price: number): string {
  return `${formatNumber(price)} TC`;
}

/**
 * Format date relative to now ("2 days ago", "5 hours ago", etc.)
 * @example formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) -> "2 days ago"
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Format date in short format (e.g., "Feb 7, 2026")
 * @example formatDate(new Date('2026-02-07')) -> "Feb 7, 2026"
 */
export function formatDate(date: Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

/**
 * Format time remaining until a given date (e.g., "2h 30m", "5d 12h")
 * @example formatTimeRemaining(new Date(Date.now() + 2.5 * 60 * 60 * 1000)) -> "2h 30m"
 * @returns Formatted time string or "Ended" if date is in the past
 */
export function formatTimeRemaining(endDate: Date): string {
  const now = new Date();
  const end = new Date(endDate);

  if (end <= now) {
    return 'Ended';
  }

  const totalSeconds = differenceInSeconds(end, now);
  const days = differenceInDays(end, now);
  const hours = differenceInHours(end, now) % 24;
  const minutes = differenceInMinutes(end, now) % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${totalSeconds}s`;
}

/**
 * Calculate percentage change between two values
 * @example calculateChange(110, 100) -> { value: 10, percent: 10, direction: 'up' }
 * @example calculateChange(90, 100) -> { value: -10, percent: -10, direction: 'down' }
 */
export function calculateChange(
  current: number,
  previous: number
): {
  value: number;
  percent: number;
  direction: 'up' | 'down' | 'same';
} {
  if (previous === 0) {
    return {
      value: current,
      percent: 0,
      direction: 'same',
    };
  }

  const value = current - previous;
  const percent = (value / previous) * 100;

  return {
    value,
    percent: Math.round(percent * 100) / 100,
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'same',
  };
}

/**
 * Get vocation color for UI badges and display
 * @example getVocationColor('Knight') -> '#ef4444"
 */
export function getVocationColor(vocation: string): string {
  const colors: Record<string, string> = {
    'Knight': '#ef4444',
    'Elite Knight': '#dc2626',
    'Paladin': '#f59e0b',
    'Royal Paladin': '#d97706',
    'Sorcerer': '#8b5cf6',
    'Master Sorcerer': '#7c3aed',
    'Druid': '#10b981',
    'Elder Druid': '#059669',
    'None': '#6b7280',
  };

  return colors[vocation] || '#9ca3af';
}

/**
 * Get deal score label and styling information
 * @example getDealScoreInfo(35) -> { label: 'Great Deal', color: '#10b981', variant: 'great' }
 * @example getDealScoreInfo(5) -> { label: 'Good Deal', color: '#3b82f6', variant: 'good' }
 * @example getDealScoreInfo(-15) -> { label: 'Overpriced', color: '#ef4444', variant: 'overpriced' }
 */
export function getDealScoreInfo(
  score: number
): {
  label: string;
  color: string;
  variant: DealScoreVariant;
} {
  if (score >= DEAL_SCORE.great) {
    return {
      label: 'Great Deal',
      color: '#10b981',
      variant: 'great',
    };
  }

  if (score >= DEAL_SCORE.good) {
    return {
      label: 'Good Deal',
      color: '#3b82f6',
      variant: 'good',
    };
  }

  if (score >= DEAL_SCORE.fair) {
    return {
      label: 'Fair',
      color: '#f59e0b',
      variant: 'fair',
    };
  }

  return {
    label: 'Overpriced',
    color: '#ef4444',
    variant: 'overpriced',
  };
}
