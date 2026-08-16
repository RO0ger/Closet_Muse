// ClosetMuse design system — "Warm Wardrobe"
// Coral is the primary brand/action color (buttons, active nav, CTAs).
// Indigo (`ai600`) is reserved EXCLUSIVELY for AI-generated content: Style Me
// chat bubbles, AI confidence/match badges, auto-tag indicators. It must
// never be used for general UI chrome — that's what keeps "this came from
// the AI" legible at a glance without a text label every time.
//
// Coral/blush/ink values below were sampled directly from the project's
// Figma exports (see Technical Reference doc), not guessed.

export const colors = {
  // Core brand
  coral900: "#7A2A12",
  coral700: "#C4451D",
  coral600: "#E35628", // primary brand accent
  coral500: "#EC7A54",
  coral100: "#FBEAE6",
  peach100: "#FCF0E2",

  // AI-layer accent — reserved exclusively for AI-generated content
  ai700: "#4A3D9E",
  ai600: "#6D5DD3",
  ai500: "#8B7DE0",
  ai100: "#EDEAFB",

  // Neutrals
  ink900: "#1A1A1A",
  ink700: "#414141",
  ink500: "#6B6B6B",
  ink300: "#A8A8A8",
  ink100: "#E6E1E1",
  ink50: "#FAF7F7",
  blush50: "#F6F0F0",
  white: "#FFFFFF",

  // Status
  success: "#1E8E5A",
  successBg: "#E4F5EC",
  danger: "#C4432B",
  dangerBg: "#FBEAE6",
  warning: "#B4790C",
  warningBg: "#FBEACB",
} as const;

export const fonts = {
  display: "Poppins_600SemiBold",
  displayBold: "Poppins_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  mono: "IBMPlexMono_500Medium",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  raised: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const app = {
  name: "ClosetMuse",
  tagline: "Your wardrobe, styled by AI.",
  supportEmail: "support@closetmuse.app",
} as const;

// Confidence-threshold constant referenced by the auto-tag review flow —
// items below this score are flagged for manual review (Technical PRD §5.1).
export const AUTO_TAG_CONFIDENCE_THRESHOLD = 0.8;
