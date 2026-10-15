// Loop 7.1 - presentDomain, the curated token sets and the SystemProvider's store.
// The acceptance line: "legacy hues = the current DOMAIN_THEME" (platform/05).
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { dateAt, LEGACY_ARC_ID, legacyActivityLog } from './support/legacyActivityLog';
import { loadLegacyDb, prefixOf } from './support/legacyDb';
import { LEGACY_BLUEPRINT_V1, legacyBlueprintFor } from '../../src/blueprint/legacy/legacyV1';
import { FALLBACK_HUE, HUE_TOKENS, isHueToken } from '../../src/library/hues';
import { FALLBACK_ICON, ICON_TOKENS, isIconToken } from '../../src/library/icons';
import { db } from '../../src/db/db';
import { getBlueprintVersionsSnapshot, refreshBlueprintVersions, resetBlueprintVersions } from '../../src/store/systemBlueprint';
import { hueTheme, presentDomain, presentDomains } from '../../src/ui/presentation/domain';
import { realityCells } from '../../src/ui/presentation/reality';
import { priorityOptions, reminderOptions } from '../../src/ui/presentation/plan';
import { ALIAS_ROUTES, aliasTarget, SHORTCUT_ROUTES } from '../../src/ui/routing/shortcuts';
import { priorityLine } from '../../src/ui/today/priorityLine';
import { coreQuestOrder, countWord, presentQuest } from '../../src/ui/presentation/quest';
import { ICONS, iconFor } from '../../src/ui/presentation/icons';
import {
  Barbell, Briefcase, Code, Cpu, Eye, MoonStars, Target,
} from '@phosphor-icons/react';

const TOKENS_CSS = readFileSync(fileURLToPath(new URL('../../src/ui/tokens.css', import.meta.url)), 'utf-8');

/** The literals src/ui/today/QuestRow.tsx has always drawn (DOMAIN_THEME) - copied here on purpose, as a golden. */
const VIOLET = { bg: 'rgba(55, 20, 85, 0.65)', border: 'rgba(192, 132, 252, 0.45)', color: '#c084fc', glow: '0 0 10px rgba(192, 132, 252, 0.35)' };
const BLUE = { bg: 'rgba(15, 45, 85, 0.65)', border: 'rgba(77, 163, 255, 0.45)', color: '#5fb2ff', glow: '0 0 10px rgba(77, 163, 255, 0.35)' };
const LEGACY_DOMAIN_THEME = { attention: BLUE, build: BLUE, career: VIOLET, dsa: VIOLET, sleep: VIOLET, training: VIOLET };
const LEGACY_QUEST_ICON = { career: Briefcase, dsa: Code, build: Cpu, training: Barbell, sleep: MoonStars, attention: Eye };

/** What a CSS variable reference resolves to on the default (dark) themes. */
function resolveVar(reference: string): string {
  const name = /^var\((--[a-z-]+)\)$/.exec(reference)![1]!;
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(TOKENS_CSS.slice(TOKENS_CSS.indexOf('1b. DOMAIN HUES')));
  return m![1]!.trim();
}

afterEach(() => resetBlueprintVersions());

describe('presentDomain (loop 7.1)', () => {
  for (const [key, expected] of Object.entries(LEGACY_DOMAIN_THEME)) {
    it(`the legacy ${key} domain draws exactly what the Today row draws now`, () => {
      const presentation = presentDomain(LEGACY_BLUEPRINT_V1, key)!;
      expect(presentation).toBeDefined();
      expect({
        bg: resolveVar(presentation.theme.bg), border: resolveVar(presentation.theme.border),
        color: resolveVar(presentation.theme.color), glow: resolveVar(presentation.theme.glow),
      }).toEqual(expected);
      expect(presentation.Glyph).toBe(LEGACY_QUEST_ICON[key as keyof typeof LEGACY_QUEST_ICON]);
    });
  }

  it('carries the designation, reality label and log verb the screens use', () => {
    const dsa = presentDomain(LEGACY_BLUEPRINT_V1, 'dsa')!;
    expect(dsa.designation).toBe('LOGIC TRIAL');
    expect(dsa.realityLabel).toBe('1 logic problem / 25m');
    expect(dsa.logVerb).toBe('Record Logic Trial');
    // A support domain has no core quest: its own designation and name stand in.
    const maintenance = presentDomain(LEGACY_BLUEPRINT_V1, 'maintenance')!;
    expect(maintenance.designation).toBe('MAINTENANCE');
    expect(maintenance.realityLabel).toBe('Maintenance');
  });

  it('returns undefined for a domain the Blueprint does not have, and orders domains by priority', () => {
    expect(presentDomain(LEGACY_BLUEPRINT_V1, 'astrology')).toBeUndefined();
    expect(presentDomains(LEGACY_BLUEPRINT_V1).map((domain) => domain.id)).toEqual(['career', 'dsa', 'build', 'training', 'sleep', 'attention', 'foundations', 'maintenance']);
  });

  it('renders an unknown icon or hue as the neutral fallback instead of failing', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.domains[0]!.presentation = { icon: 'NotAnIcon', hue: 'chartreuse' };
    const presentation = presentDomain(blueprint, blueprint.domains[0]!.id)!;
    expect(presentation.Glyph).toBe(Target);
    expect(presentation.hue).toBe(FALLBACK_HUE);
    expect(iconFor(undefined)).toBe(ICONS[FALLBACK_ICON]);
    expect(hueTheme(undefined).theme.color).toBe(`var(--hue-${FALLBACK_HUE}-color)`);
  });

  it('never puts a raw colour from data into the output - only variable references', () => {
    for (const hue of HUE_TOKENS) {
      for (const value of Object.values(hueTheme(hue).theme)) expect(value).toMatch(/^var\(--hue-[a-z]+-(bg|border|color|glow)\)$/);
    }
    expect(Object.values(hueTheme('#ff0000').theme).every((value) => value.startsWith('var(--hue-slate-'))).toBe(true);
  });
});

describe('the curated token sets', () => {
  it('has 48 icons, each with a component, and nothing else in the map', () => {
    expect(ICON_TOKENS).toHaveLength(48);
    expect(new Set(ICON_TOKENS).size).toBe(48);
    expect(Object.keys(ICONS).sort()).toEqual([...ICON_TOKENS].sort());
    for (const token of ICON_TOKENS) expect(ICONS[token], token).toBeTruthy();
  });

  it('has 8 hues', () => {
    expect(HUE_TOKENS).toHaveLength(8);
    expect(isHueToken('violet')).toBe(true);
    expect(isHueToken('chartreuse')).toBe(false);
    expect(isIconToken('Cpu')).toBe(true);
    expect(isIconToken('cpu')).toBe(false);
  });

  it('covers every icon and hue the owner\'s System uses', () => {
    for (const domain of LEGACY_BLUEPRINT_V1.domains) {
      expect(isIconToken(domain.presentation.icon), `${domain.id} icon`).toBe(true);
      expect(isHueToken(domain.presentation.hue), `${domain.id} hue`).toBe(true);
    }
    for (const group of LEGACY_BLUEPRINT_V1.attributes.groups) expect(isIconToken(group.icon), `${group.id} icon`).toBe(true);
  });
});

describe('the Blueprint versions store (what SystemProvider serves)', () => {
  it('falls back to the owner\'s System with no arc, and reads the resolved versions once there is one', async () => {
    resetBlueprintVersions();
    await db.open();
    await refreshBlueprintVersions();
    expect(getBlueprintVersionsSnapshot()).toHaveLength(1);
    expect(getBlueprintVersionsSnapshot()[0]).toBe(LEGACY_BLUEPRINT_V1);

    const log = legacyActivityLog({ seed: 3, days: 5 });
    await loadLegacyDb(prefixOf(log, dateAt(4)), dateAt(4));
    await refreshBlueprintVersions();
    const versions = getBlueprintVersionsSnapshot();
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe(1);
    expect(versions[0]!.arcId).toBe(LEGACY_ARC_ID);
  });
});

// The strings Today has always carried per quest (ui/today/criterionText.ts), copied here as goldens.
const LEGACY_ROW_SUMMARY = {
  career: '3 despatches / 25m focus', dsa: '1 logic problem / 25m', build: '45m construct session',
  training: 'conditioning or 8k steps', sleep: 'sync window 08:00–09:00', attention: 'friction control ≤ 60m',
};
const LEGACY_CRITERION_TEXT = {
  career: '3 verified despatches, or 25 minutes of substitute ascension focus.',
  dsa: '1 logic problem logged, or 25 minutes of algorithm analysis.',
  build: '45+ minutes of construct work, tagged ASSIMILATE or MANIFEST.',
  training: 'A physical conditioning session, or 8,000+ steps registered.',
  sleep: 'Synchronization active: wake within 30 minutes of 08:30 (08:00–09:00).',
  attention: 'Cognitive friction control: 60 minutes or under screen time.',
};

describe('presentQuest (loop 7.5)', () => {
  for (const key of Object.keys(LEGACY_ROW_SUMMARY) as (keyof typeof LEGACY_ROW_SUMMARY)[]) {
    it(`the legacy ${key} quest reads as its row has always read`, () => {
      const presentation = presentQuest(LEGACY_BLUEPRINT_V1, key);
      expect(presentation.summary).toBe(LEGACY_ROW_SUMMARY[key]);
      expect(presentation.objective).toBe(LEGACY_CRITERION_TEXT[key]);
      expect(presentation.domainId).toBe(key);
      expect(presentation.Glyph).toBe(LEGACY_QUEST_ICON[key]);
      expect(resolveVar(presentation.theme.color)).toBe(LEGACY_DOMAIN_THEME[key].color);
    });
  }

  it('walks the core quests in priority order, as the priority line always has', () => {
    expect(coreQuestOrder(LEGACY_BLUEPRINT_V1)).toEqual(['career', 'dsa', 'build', 'training', 'sleep', 'attention']);
  });

  it('finds the domain of a quest whose id is not its domain, and degrades for an unknown quest', () => {
    const blueprint = legacyBlueprintFor();
    blueprint.quests.find((quest) => quest.id === 'dsa')!.id = 'q.logic';
    expect(presentQuest(blueprint, 'q.logic').domainId).toBe('dsa');
    const unknown = presentQuest(blueprint, 'nope');
    expect(unknown.domainId).toBeUndefined();
    expect(unknown.theme.color).toBe(`var(--hue-${FALLBACK_HUE}-color)`);
  });

  it('says counts as words', () => {
    expect([0, 1, 6, 12, 13].map(countWord)).toEqual(['No', 'One', 'Six', 'Twelve', '13']);
  });
});

describe('priorityLine over the Blueprint order (loop 7.5)', () => {
  const template = (key: string, intention?: { time: string }) => ({ id: `t-${key}`, key, title: key.toUpperCase(), implementation_intention: intention }) as never;
  const instance = (key: string, state: 'available' | 'complete') => ({ id: `i-${key}`, template_id: `t-${key}`, state }) as never;
  const arc = { start_date: '2026-09-01', end_date: '2026-12-29' };

  it('names the first incomplete quest in the Blueprint order, with its intention time when it has one', () => {
    const templates = [template('a', { time: '07:30' }), template('b')];
    const open = [instance('a', 'available'), instance('b', 'available')];
    expect(priorityLine(templates, open, '2026-10-01', arc, ['b', 'a'])).toBe('⟨ B ⟩ Outstanding requirement.');
    expect(priorityLine(templates, open, '2026-10-01', arc, ['a', 'b'])).toBe('⟨ A ⟩ Required at 07:30.');
  });

  it('counts the day in words: six of six for the owner, three of three for a smaller System', () => {
    const six = Array.from({ length: 6 }, (_, n) => instance(`q${n}`, 'complete'));
    expect(priorityLine([], six, '2026-10-01', arc, [])).toBe('Six of six. Day closed.');
    expect(priorityLine([], six.slice(0, 3), '2026-10-01', arc, [])).toBe('Three of three. Day closed.');
  });

  it('keeps its three other states', () => {
    expect(priorityLine([], [], '2026-08-01', arc, [])).toContain('ARC INITIALIZATION');
    expect(priorityLine([], [], '2027-01-01', arc, [])).toContain('ARC CONCLUDED');
    expect(priorityLine([], [], '2026-10-01', arc, [])).toContain('NO ACTIVE QUESTS');
  });
});

describe('Progress from the Blueprint (loop 7.6)', () => {
  it('the legacy attribute groups are the three cards the screen has always drawn, in order', () => {
    const groups = LEGACY_BLUEPRINT_V1.attributes.groups
      .map((group) => ({ id: group.id, heading: group.heading, tagline: group.tagline, layout: group.layout, icon: group.icon, attributes: LEGACY_BLUEPRINT_V1.attributes.defs.filter((definition) => definition.groupId === group.id).map((definition) => definition.name) }))
      .filter((group) => group.attributes.length > 0);
    expect(groups).toEqual([
      { id: 'mind', heading: 'MIND', tagline: 'A SHARPER YOU', layout: 'mind', icon: 'Brain', attributes: ['DISCIPLINE', 'DEPTH', 'PROBLEM SOLVING'] },
      { id: 'craft', heading: 'CRAFT', tagline: 'BUILD SKILLS. BUILD OPTIONS.', layout: 'craft', icon: 'Cpu', attributes: ['ENGINEERING', 'MOMENTUM'] },
      { id: 'body', heading: 'BODY', tagline: 'A STRONGER YOU', layout: 'body', icon: 'Barbell', attributes: ['VITALITY'] },
    ]);
    expect(LEGACY_BLUEPRINT_V1.origin).toBe('legacy');
    expect(LEGACY_BLUEPRINT_V1.arc.lengthDays).toBe(120);
  });

  const rows = LEGACY_BLUEPRINT_V1.reality!;
  const cells = (values: Record<string, number>) => rows.map((row) => realityCells(row, values));

  it('the REALITY tab prints the owner\'s eight rows exactly as it did', () => {
    const empty = { problems: 0, firstAttemptRateM: 0, publicProjects: 0, evals: 0, applications: 0, qualityRate: 0, followThroughRate: 0, foundationsFluentOrBetter: 0 };
    expect(cells(empty)).toEqual([
      { label: 'Problems', day0: '0', now: '0' },
      { label: 'First-attempt M', day0: '—', now: '—' },
      { label: 'Public projects', day0: '0', now: '0' },
      { label: 'Evals', day0: '0', now: '0' },
      { label: 'Applications', day0: '0', now: '0' },
      { label: 'Quality rate', day0: '—', now: '—' },
      { label: 'Follow-through', day0: '—', now: '—' },
      { label: 'Foundations Fluent+', day0: '0 / 9', now: '0 / 9' },
    ]);
    const live = { problems: 52, firstAttemptRateM: 0.456, publicProjects: 2, evals: 1, applications: 31, qualityRate: 0.8, followThroughRate: 0.5, foundationsFluentOrBetter: 4 };
    expect(cells(live).map((cell) => cell.now)).toEqual(['52', '46%', '2', '1', '31', '80%', '50%', '4 / 9']);
    // A quality rate needs applications behind it, whatever the rate says.
    expect(cells({ ...live, applications: 0 })[5]!.now).toBe('—');
  });
});

describe('plan options, shortcuts and checkpoints from the Blueprint (loop 7.8)', () => {
  it('the evening review offers the four engine domains under the names it always used', () => {
    expect(priorityOptions(LEGACY_BLUEPRINT_V1)).toEqual([
      { questId: 'career', label: 'Career' }, { questId: 'dsa', label: 'DSA' }, { questId: 'build', label: 'Build' }, { questId: 'training', label: 'Train' },
    ]);
  });

  it('the reminder settings offer the three domains that allow an intention, as they always did', () => {
    expect(reminderOptions(LEGACY_BLUEPRINT_V1)).toEqual([
      { questId: 'career', label: 'Career' }, { questId: 'dsa', label: 'DSA' }, { questId: 'training', label: 'Training' },
    ]);
  });

  it('another System is offered its own domains by name', () => {
    const blueprint = legacyBlueprintFor();
    delete blueprint.origin;
    blueprint.domains.find((domain) => domain.id === 'dsa')!.name = 'Logic';
    expect(priorityOptions(blueprint).map((option) => option.label)).toEqual(['Job search', 'Logic', 'Building', 'Training']);
  });

  it('the aliases resolve to the domain that declares the slot; the legacy paths are untouched', () => {
    expect(aliasTarget(LEGACY_BLUEPRINT_V1.domains, 'primary')).toBe('dsa');
    expect(aliasTarget(LEGACY_BLUEPRINT_V1.domains, 'evidence')).toBe('career');
    expect(aliasTarget([{ id: 'x' }], 'primary')).toBeNull();
    expect(SHORTCUT_ROUTES.map((route) => route.path)).toEqual(['/log/problem', '/log/application', '/review']);
    expect(ALIAS_ROUTES.map((route) => route.path)).toEqual(['/log/primary', '/log/evidence']);
  });

  it('the checkpoint schedule is the Blueprint\'s', () => {
    expect(LEGACY_BLUEPRINT_V1.progression.checkpointDays).toEqual([14, 30, 60, 90, 120]);
  });
});
