/**
 * Lightweight analytics service for WordForge.
 * No external libraries, no cookies, no fingerprinting.
 * Sends beacon events for meaningful actions only.
 */

interface AnalyticsEvent {
  event: string;
  timestamp: number;
  duration?: number;
  wordCount?: number;
  inputLength?: number;
  error?: string;
}

const QUEUE: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Log an analytics event (batch-flushed via beacon) */
export function track(event: string, data?: Omit<AnalyticsEvent, 'event' | 'timestamp'>): void {
  const payload: AnalyticsEvent = {
    event,
    timestamp: Date.now(),
    ...data,
  };

  QUEUE.push(payload);

  // Batch flush after 2s or when queue reaches 10 events
  if (QUEUE.length >= 10) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, 2000);
  }

  // Always log to console in development
  if (import.meta.env?.DEV) {
    console.log('[Analytics]', payload);
  }
}

/** Flush the event queue */
export function flush(): void {
  if (QUEUE.length === 0) return;

  const events = QUEUE.splice(0, QUEUE.length);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // Try navigator.sendBeacon first (reliable on page unload)
  const payload = JSON.stringify({ events });
  const endpoint = '/api/analytics';

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Silently fail — analytics should never break the user experience
      });
    }
  } catch {
    // Silently fail
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
  window.addEventListener('pagehide', flush);
}
