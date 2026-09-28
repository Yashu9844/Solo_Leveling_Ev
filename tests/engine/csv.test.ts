import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvWithHeader } from '../../src/engine/csv';

describe('parseCsv', () => {
  it('parses plain comma-separated rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('a,b\n1,"hello, world"')).toEqual([
      ['a', 'b'],
      ['1', 'hello, world'],
    ]);
  });

  it('handles escaped double quotes inside a quoted field', () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([['a'], ['she said "hi"']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCsvWithHeader', () => {
  it('maps rows to objects keyed by the lowercased header', () => {
    const result = parseCsvWithHeader('Date,DSA,Note\n2026-09-01,1,"went well"');
    expect(result).toEqual([{ date: '2026-09-01', dsa: '1', note: 'went well' }]);
  });

  it('returns [] for an empty string', () => {
    expect(parseCsvWithHeader('')).toEqual([]);
  });
});
