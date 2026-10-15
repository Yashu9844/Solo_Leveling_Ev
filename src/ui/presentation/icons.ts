// Icon token -> Phosphor component. The token list is src/library/icons.ts; the
// Record type makes a token without a component a compile error, and
// tests/engine/presentation.test.ts makes the reverse true as well.
import {
  Barbell, BookOpen, Books, Bicycle, Brain, Briefcase, Broom, Camera, ChartLineUp, ChatCircle, Code, Coffee,
  Coins, Compass, Cpu, Envelope, Eye, Flag, Flame, GraduationCap, Hammer, Handshake, Heart, Heartbeat, Hourglass,
  Leaf, Lightbulb, Lightning, Microphone, MoonStars, Mountains, MusicNotes, Notebook, Palette, PencilLine,
  PersonSimpleRun, PersonSimpleTaiChi, Plant, PuzzlePiece, Rocket, Star, Sun, Target, Timer, Translate, Users,
  Wallet, Wrench, type Icon,
} from '@phosphor-icons/react';
import { FALLBACK_ICON, isIconToken, type IconTokenName } from '../../library/icons';

export const ICONS: Record<IconTokenName, Icon> = {
  Briefcase, Code, Cpu, Barbell, MoonStars, Eye, BookOpen, Broom, Brain,
  Books, GraduationCap, Translate, PencilLine, Palette, MusicNotes, Camera, Microphone, Notebook,
  Hammer, Wrench, Lightbulb, PuzzlePiece,
  Heart, Heartbeat, PersonSimpleRun, Bicycle, PersonSimpleTaiChi, Sun, Coffee, Leaf, Plant,
  Timer, Hourglass, Target, Flag, Rocket, Lightning, Flame, Mountains, Compass, Star,
  Wallet, Coins, ChartLineUp, Users, ChatCircle, Handshake, Envelope,
};

/** The component for a Blueprint's icon token; an unknown token renders the generic glyph rather than failing. */
export function iconFor(token: string | undefined): Icon {
  return ICONS[isIconToken(token) ? token : FALLBACK_ICON];
}
