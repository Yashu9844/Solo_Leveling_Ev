import { describe, it, expect } from 'vitest';
import { parseDailyLog, parseDsaLog, slugifyProblemTitle } from '../../src/engine/paperImport';

describe('parseDailyLog', () => {
  it('parses a well-formed row exactly per docs/13-day0-baseline.md', () => {
    const csv =
      'date,dsa,bld,trn,slp,fue,att,wake,sleep,scrn,energy,focus,blocker,note\n' +
      '2026-09-01,1,1,1,1,0,1,06:34,23:10,47,3,4,fuel,';
    const { entries, errors } = parseDailyLog(csv);
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      date: '2026-09-01',
      dsa: 'complete',
      bld: 'complete',
      trn: 'complete',
      slp: 'complete',
      fue: 'none',
      att: 'complete',
      wake: '06:34',
      sleep: '23:10',
      screenMinutes: 47,
      energy: 3,
      focus: 4,
    });
    // "fuel" isn't in the doc's blocker vocabulary (time/tired/wrongtime/
    // didntwant/none) -- an unrecognized blocker is simply omitted, not
    // an error (it's a free-ish text cell in practice).
    expect(entries[0]!.blocker).toBeUndefined();
  });

  it('maps "m" to floor and blank/0 to none', () => {
    const csv = 'date,dsa,bld,trn,slp,fue,att\n2026-09-02,m,0,,1,m,1';
    const { entries, errors } = parseDailyLog(csv);
    expect(errors).toEqual([]);
    expect(entries[0]).toMatchObject({ dsa: 'floor', bld: 'none', trn: 'none', slp: 'complete', fue: 'floor', att: 'complete' });
  });

  it('maps the doc\'s exact blocker vocabulary', () => {
    const csv = 'date,dsa,bld,trn,slp,fue,att,blocker\n2026-09-03,1,1,1,1,1,1,wrongtime';
    const { entries } = parseDailyLog(csv);
    expect(entries[0]!.blocker).toBe('wrong_time');
  });

  it('reports a row-level error for a bad date without aborting the rest of the file', () => {
    const csv = 'date,dsa,bld,trn,slp,fue,att\nnot-a-date,1,1,1,1,1,1\n2026-09-01,1,1,1,1,1,1';
    const { entries, errors } = parseDailyLog(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.date).toBe('2026-09-01');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('row 2');
  });

  it('reports a row-level error for an invalid mark value', () => {
    const csv = 'date,dsa,bld,trn,slp,fue,att\n2026-09-01,X,1,1,1,1,1';
    const { errors } = parseDailyLog(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('dsa');
  });
});

describe('parseDsaLog', () => {
  it('parses a well-formed row exactly per docs/13-day0-baseline.md', () => {
    const csv = 'date,problem,topic,diff,outcome,min,insight\n2026-09-01,Course Schedule II,graphs,M,hint,34,topo sort via indegree';
    const { entries, errors } = parseDsaLog(csv);
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { date: '2026-09-01', problem: 'Course Schedule II', topic: 'graphs', difficulty: 'M', outcome: 'hint', minutes: 34, insight: 'topo sort via indegree' },
    ]);
  });

  it('rejects an invalid difficulty and an invalid outcome, independently', () => {
    const csv =
      'date,problem,topic,diff,outcome,min\n' +
      '2026-09-01,A,arrays,X,first,10\n' +
      '2026-09-02,B,arrays,M,maybe,10';
    const { entries, errors } = parseDsaLog(csv);
    expect(entries).toEqual([]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('diff');
    expect(errors[1]).toContain('outcome');
  });

  it('defaults topic to "Uncategorized" when blank', () => {
    const csv = 'date,problem,topic,diff,outcome,min\n2026-09-01,Two Sum,,E,first,5';
    const { entries } = parseDsaLog(csv);
    expect(entries[0]!.topic).toBe('Uncategorized');
  });
});

describe('slugifyProblemTitle', () => {
  it('matches the manual-entry convention (lowercase, spaces -> hyphens)', () => {
    expect(slugifyProblemTitle('Course Schedule II')).toBe('course-schedule-ii');
  });
});
