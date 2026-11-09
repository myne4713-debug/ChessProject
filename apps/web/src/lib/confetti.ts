import confetti from 'canvas-confetti';

/**
 * Trigger celebration confetti with respectful reduced-motion fallback.
 * If the user has requested reduced motion in their OS or browser settings,
 * particle animation is suppressed to avoid vestibular trigger or motion sickness.
 */
export function fireConfetti(options?: confetti.Options): void {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    return;
  }
  try {
    confetti(options);
  } catch {
    // Graceful no-op in headless/non-canvas environments
  }
}

export default fireConfetti;
