// A small, dependency-free RFC4180-ish CSV parser. No library added
// (project convention: no new dependency without asking) — this is a
// self-contained ~30-line parser, not a generalized CSV engine; it
// handles quoted fields (with embedded commas and escaped "" quotes)
// and CRLF/LF line endings, which is everything docs/13-day0-baseline.md's
// two importable tables need.

/** Pure. Parses CSV text into rows of raw string cells (no header
 * handling, no type coercion — engine/paperImport.ts does that). Blank
 * lines are skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  function endField() {
    row.push(field);
    field = '';
  }
  function endRow() {
    endField();
    if (row.some((cell) => cell.length > 0)) rows.push(row);
    row = [];
  }

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\n') {
      endRow();
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) endRow();

  return rows;
}

/** Pure. Parses CSV text with a header row into an array of plain
 * objects keyed by the (trimmed, lowercased) header cell. */
export function parseCsvWithHeader(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = (row[i] ?? '').trim();
    });
    return obj;
  });
}
