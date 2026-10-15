// The voice of the owner's Skills screen: its tab names, section titles, tier ladder of AI skills,
// the Career Tree and the Dungeon Gate benchmark. A generic System's trees get plain titles from
// the Blueprint (tree name, domain glyph); the owner's render exactly as they always have (E3).
// Phosphor glyphs outside the curated token set are allowed here and nowhere else under ui/.
import { Code, Cpu, Sparkle, Sword, Trophy, type Icon } from '@phosphor-icons/react';

export interface TreeCopy {
  tab: string;
  tabIcon: Icon;
  title: string;
  tagline: string;
  sectionIcon: Icon;
  /** The label on the hero card's stat for this tree. */
  badge: string;
  badgeIcon: Icon;
  emptyMessage: string;
  /** Whether the tree counts toward the hero card's overall percentage. */
  inOverall: boolean;
  /** A tree shown as a ladder of tiers rather than a flat list. */
  tiers?: { title: string; subtitle: string; rank: string; items: string[] }[];
}

export const LEGACY_TREE_COPY: Record<string, TreeCopy> = {
  dsa: {
    tab: 'DSA POWER', tabIcon: Code, title: 'DSA Algorithmic Power', tagline: 'CORE SPELLS', sectionIcon: Code,
    badge: 'DSA Power', badgeIcon: Code, emptyMessage: 'No matching algorithms found.', inOverall: true,
  },
  foundations: {
    tab: 'ARCHITECT', tabIcon: Cpu, title: 'SE Foundations', tagline: 'SYSTEM ARCHITECTURE', sectionIcon: Cpu,
    badge: 'SE Architect', badgeIcon: Cpu, emptyMessage: 'No matching architecture topics found.', inOverall: true,
  },
  ai: {
    tab: 'AI SPELLS', tabIcon: Sparkle, title: 'AI / Agentic Spells', tagline: 'FRONTIER TECH TIERS', sectionIcon: Sparkle,
    badge: 'AI Spells', badgeIcon: Sparkle, emptyMessage: '', inOverall: false,
    tiers: [
      {
        title: 'Tier 0 — Table Stakes', subtitle: 'CORE FOUNDATIONS', rank: 'E-RANK',
        items: ['LLM Fundamentals', 'Prompting with Cache-Awareness', 'Structured Outputs', 'Tool Calling', 'Embeddings', 'RAG Basics', 'Vector Store Selection', 'Model Landscape & Pricing'],
      },
      {
        title: 'Tier 1 — Differentiators', subtitle: 'ADVANCED CAPABILITIES', rank: 'B-RANK',
        items: ['Evaluation Design', 'Agent Orchestration', 'Context Engineering', 'MCP Protocol', 'Cost & Latency Optimization'],
      },
      {
        title: 'Tier 2 — Production Engine', subtitle: 'PRODUCTION ARCHITECTURES', rank: 'A-RANK',
        items: ['Observability & Tracing', 'Guardrails & OWASP LLM Risks', 'Sandboxing & Kill-Switches', 'Production Deployment', 'Async Job Architecture'],
      },
      {
        title: 'Tier 3 — Frontier Tier', subtitle: 'MONARCH ARCHITECTURES', rank: 'S-RANK',
        items: ['Multi-Agent Coordination', 'Computer-Use / Vision-Action Loops', 'Custom Fine-Tuning'],
      },
    ],
  },
};

export const LEGACY_SKILLS_SCREEN = {
  allTab: 'ALL SPELLS',
  quote: 'Skills are not granted by favour. They are forged in the dungeon of unyielding discipline.',
  gaugeLabel: 'MANA & SPELL MASTERY',
  searchPlaceholder: 'Search skills, algorithms, architecture, AI spells...',
};

/** The Career Tree panel's tab and heading. */
export const LEGACY_CAREER_PANEL = { tab: 'CAREER PATH', tabIcon: Trophy, title: 'Career Tree', tagline: 'ARTEFACTS & INTERVIEWS' };

export interface SelfCertCopy {
  tab: string;
  tabIcon: Icon;
  title: string;
  tagline: string;
  heading: string;
  rules: string;
  statusLabel: string;
  cleared: string;
  uncleared: string;
  passButton: string;
  failButton: string;
  recording: string;
  logsHeading: string;
  rowPassed: string;
  rowFailed: string;
  glyph: Icon;
  artSlot?: 'training';
}

export const LEGACY_SELF_CERT: Record<string, SelfCertCopy> = {
  interview_benchmark: {
    tab: 'DUNGEON GATE', tabIcon: Sword, title: 'Interview Readiness Benchmark', tagline: 'S-RANK DUNGEON GATE',
    heading: 'DUNGEON GATE PROTOCOL RULES',
    rules: '3 randomly-drawn medium DSA challenges · 90 minutes total duration · unseen test cases · first-attempt working solution with full space-time complexity analysis.',
    statusLabel: 'BENCHMARK GATE STATUS:', cleared: '✓ GATE CLEARED', uncleared: 'UNCLEARED GATE',
    passButton: 'GATE CLEARED', failButton: 'RETRIED / FAILED', recording: 'RECORDING...',
    logsHeading: 'DUNGEON ENTRY LOGS', rowPassed: '✓ CLEARED', rowFailed: 'RETRIED', glyph: Sword, artSlot: 'training',
  },
};
