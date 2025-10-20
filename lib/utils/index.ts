export { cn } from './cn';

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculate days until expiration
 */
export function daysUntilExpiration(expirationDate: string): number {
  const expiry = new Date(expirationDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if an item is low stock
 */
export function isLowStock(quantity: number, threshold: number): boolean {
  return quantity <= threshold;
}

/**
 * Check if an item is expiring soon (within 7 days)
 */
export function isExpiringSoon(expirationDate: string): boolean {
  const days = daysUntilExpiration(expirationDate);
  return days > 0 && days <= 7;
}

