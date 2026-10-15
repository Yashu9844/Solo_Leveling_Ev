// The HUD dressing of the owner's FOUNDATIONAL TRIAL sheet: its taglines, its quote banner and the
// glyph beside each topic. A generic study sheet shows none of it (platform/03 §27.2); the owner's
// renders exactly as it always has (E3).
import { BookOpen, Code, Cpu, Database, Globe, TreeStructure, type Icon } from '@phosphor-icons/react';

export interface StudyCopy {
  eyebrow: string;
  tagline: string;
  banner: { line: string; aside: string };
  footnote: string;
  topicIcons: Record<string, Icon>;
  designModeLabels: Record<string, string>;
}

export const LEGACY_STUDY_COPY: Record<string, StudyCopy> = {
  'foundations.blocks': {
    eyebrow: 'FOUNDATION MASTERY',
    tagline: 'Deliberate study transforms concepts into intuition.',
    banner: { line: 'KNOWLEDGE REINFORCED BECOMES INTUITION.', aside: 'MASTER THE BASICS' },
    footnote: '— DELIBERATE PRACTICE. INTELLECTUAL EVIDENCE. —',
    topicIcons: {
      'System Design': Cpu, 'Data Structures': TreeStructure, 'Algorithms': Code, 'Web Architecture': Globe, 'Databases': Database,
    },
    designModeLabels: { studied: 'Studied', written_up: 'Written up', explained_aloud: 'Explained aloud' },
  },
};

export const FALLBACK_TOPIC_ICON: Icon = BookOpen;
