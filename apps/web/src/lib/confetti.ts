import type { Options } from 'canvas-confetti';

/**
 * Trigger celebration confetti with respectful reduced-motion fallback.
 * Dynamically imports canvas-confetti only when triggered to keep initial bundles light.
 */
export function fireConfetti(options?: Options): void {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    return;
  }
  void import('canvas-confetti')
    .then((mod) => {
      try {
        mod.default(options);
      } catch {
        // Graceful no-op in headless/non-canvas environments
      }
    })
    .catch(() => {
      // Ignore lazy-load failure for non-critical celebration effect
    });
}

export default fireConfetti;
