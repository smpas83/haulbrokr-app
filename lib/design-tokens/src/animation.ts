/** Animation timing tokens — durations and easings are placeholders. */
export const durations = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

export const easings = {
  linear: "linear",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const animation = {
  durations,
  easings,
  /** Preset animation names for wrappers — timing overridden by design system. */
  presets: {
    fadeIn: { duration: durations.normal, easing: easings.easeOut },
    slideUp: { duration: durations.normal, easing: easings.easeOut },
    scaleIn: { duration: durations.fast, easing: easings.spring },
    hoverCard: { duration: durations.fast, easing: easings.easeInOut },
    loading: { duration: durations.slow, easing: easings.linear },
    page: { duration: durations.normal, easing: easings.easeInOut },
  },
} as const;
