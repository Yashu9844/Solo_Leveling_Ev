# Settings & Theming

A modern, fully configurable appearance and application settings layer.

> **This overrules two decisions in `final/06`.** §4.1 said *"Dark-only. A light theme is
> not in V1 and probably never."* §3 cut a settings screen down to *"3 fields inside
> Settings."* The user has asked for the opposite: everything configurable, modern
> settings conventions. That is their call and it is implemented in full.
>
> One piece of the original reasoning is kept because it is still true — this app is opened
> at 08:30 and 02:00. So the **default stays dark**, four of the five themes are dark, and
> the light theme is opt-in rather than system-following.

---

## 1. What is configurable

### Appearance

| Setting | Values | Default |
|---|---|---|
| **Theme** | `arc` · `dawn` · `abyss` · `contrast` · `daylight` | `arc` |
| **Accent** | mana blue · monarch violet · ember · jade · gold | follows theme |
| **Text size** | XS · S · M · L · XL (0.88 → 1.25 ×) | M |
| **Density** | comfortable · compact | comfortable |
| **Motion** | system · full · reduced | system |
| **Art intensity** | full · dim · off | full |
| **Glow** | on · off | on |

### System

Reminder times (the three implementation-intention alarms from onboarding) · evening
review time · weekly review day · week starts on · show day-boundary hint.

> **As built, only the first of these exists**, and the omission is deliberate. Editing a
> reminder is real: it appends `PLAN_AMENDED`, the event that has existed since Slice 1 for
> exactly this and had no caller after onboarding, and the quest templates regenerate from
> it. The rest are not concepts this engine has — the evening review is available all day
> until it is done, and the weekly review measures a rolling seven days ending today rather
> than a calendar week. A control that changes nothing is not configuration, so the System
> screen shows the arc's hours read-only instead, with the reason on screen: every streak,
> rollup and checkpoint in the record was computed against them.
>
> Reminders are also the one setting that is **not** in localStorage. §2's line is about
> device preferences; an implementation intention is a commitment the arc is measured
> against, and when you changed it is part of the record.

### Data

Export backup · import backup · paper import · storage used · verify integrity.

### About

Version · arc start and end dates · day number · reset arc (double-confirmed).

---

## 2. Storage — `localStorage`, not the event log

Settings live at `localStorage['system.settings.v1']` as one JSON object.

**They are deliberately not events.** This app is event-sourced, and
`db/projections.ts → verifyIntegrity()` rebuilds every projection from the log and diffs it
against the live tables. That check is only meaningful because the log contains
*evidence about the arc*. A theme change is a device preference — it has no bearing on
whether four months changed anything. Writing it to the log would pollute the record and
weaken the integrity guarantee for no benefit.

Consequences, all intended:

- Settings do not sync across devices. Correct: text size on a phone should not follow you
  to a tablet.
- Settings survive a `resetArc()`. Correct: re-onboarding should not reset your text size.
- Backup export includes them under a separate top-level `settings` key, clearly marked
  non-evidential, and import treats them as optional.

## 3. Applying settings before first paint

A theme that arrives after React mounts causes a visible flash. So an inline bootstrap in
`index.html` — synchronous, before the module script — reads the same key and stamps the
root element:

```html
<script>
  try {
    var s = JSON.parse(localStorage.getItem('system.settings.v1') || '{}');
    var d = document.documentElement;
    d.dataset.theme     = s.theme     || 'arc';
    d.dataset.textScale = s.textScale || 'm';
    d.dataset.density   = s.density   || 'comfortable';
    d.dataset.motion    = s.motion    || 'system';
    d.dataset.art       = s.art       || 'full';
    if (s.accent) d.style.setProperty('--accent-user', s.accent);
  } catch (e) {}
</script>
```

`SettingsProvider` then reads the same key, exposes `useSettings()`, and re-stamps those
attributes on every write. The CSS in `tokens.css` is keyed off exactly these attributes,
so there is one mechanism, not two.

```css
:root                      { /* structural tokens + theme `arc` */ }
[data-theme="dawn"]        { /* … */ }
[data-theme="abyss"]       { /* … */ }
[data-theme="contrast"]    { /* … */ }
[data-theme="daylight"]    { color-scheme: light; /* … */ }

[data-text-scale="xs"] { --type-scale: .88 }
[data-text-scale="s"]  { --type-scale: .94 }
[data-text-scale="m"]  { --type-scale: 1 }
[data-text-scale="l"]  { --type-scale: 1.12 }
[data-text-scale="xl"] { --type-scale: 1.25 }

[data-density="compact"] { --gutter: 18px; --row-min: 56px }
[data-art="dim"]  { --art-opacity: .45 }
[data-art="off"]  { --art-opacity: 0; --glow-sm:none; --glow-md:none; --glow-lg:none }
```

**`--type-scale` multiplies the whole scale, not just body copy** — otherwise headings and
data stop relating to each other at the extremes.

---

## 4. The settings UI

Modern grouped-list conventions, mobile-first — what a person expects from a phone
settings screen, not a web form.

- **Groups** with an `xxs` uppercase header and a hairline, cards with cut corners.
- **Rows** are 56px minimum: leading phosphor icon, label, trailing current value in
  `--ink-700`, chevron if it pushes a sub-screen.
- **Inline controls** for ≤3 choices (`Segmented`); **pushed sub-screens** for more.
- **A live preview panel** pinned at the top of Appearance: a miniature quest row, an XP
  meter, a section label and a quote line, rendered in the pending settings. You see the
  change before you commit to it.
- **Instant application** — no Save button. Every control applies on change.
- **Destructive rows** (reset arc, import over existing data) are `--state-alert`, isolated
  in their own group at the very bottom, and double-confirm.

Settings is the one screen with **no art and no glow**. A settings screen is not a stage;
making it dramatic would make it harder to use.

---

## 5. Every theme must pass the same bar

For each of the five themes, before it ships:

- Body text ≥ 4.5:1 against its own ground, measured, recorded in `tokens.css` comments.
- `--state-complete`, `--state-recover` and `--state-alert` remain distinguishable, and
  every state still carries a shape as well as a colour.
- The Gold Horizon art surfaces still read correctly (a gold plate on the `daylight` theme
  needs a different scrim than on `arc` — the `ArtLayer` scrim is theme-aware).
- No horizontal overflow at 320px with text scale XL and density comfortable — the worst
  case, and the one the responsive spec actually tests.
