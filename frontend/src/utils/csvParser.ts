/**
 * Client-side CSV parser that auto-detects delimiters (comma, semicolon, tab)
 * and correctly handles quote escaping.
 * Runs instantly without calling the backend.
 */
export function parseCSVClient(text: string): { headers: string[]; rows: any[]; rawData: string[][] } {
  // Strip BOM if present
  let cleanText = text;
  if (text.startsWith('\uFEFF')) {
    cleanText = text.substring(1);
  }

  const lines = cleanText.split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    return { headers: [], rows: [], rawData: [] };
  }

  // Detect delimiter based on first line
  const firstLine = lines[0] || '';
  const delimiters = [',', ';', '\t'];
  let maxCount = 0;
  let delimiter = ',';
  
  for (const d of delimiters) {
    const regex = new RegExp(d === '\t' ? '\\t' : '\\' + d, 'g');
    const count = (firstLine.match(regex) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }

  // Parse a CSV line respecting quotes
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === delimiter && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const rawData: string[][] = [];
  for (const line of lines) {
    if (line.trim() !== '') {
      rawData.push(parseLine(line));
    }
  }

  if (rawData.length === 0) {
    return { headers: [], rows: [], rawData: [] };
  }

  const headers = rawData[0];
  const rows: any[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const rowObj: any = {};
    const rawRow = rawData[i];
    
    headers.forEach((header, idx) => {
      rowObj[header] = rawRow[idx] !== undefined ? rawRow[idx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows, rawData };
}
