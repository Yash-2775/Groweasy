import { parse } from 'csv-parse';

/**
 * Detects the delimiter in a CSV string based on the first line.
 * Supports comma (,), semicolon (;), and tab (\t).
 * @param {string} firstLine 
 * @returns {string}
 */
function detectDelimiter(firstLine) {
  const delimiters = [',', ';', '\t'];
  let maxCount = 0;
  let detectedDelimiter = ',';

  for (const delimiter of delimiters) {
    // Count occurrences of the delimiter in the first line
    const count = (firstLine.match(new RegExp(delimiter === '\t' ? '\\t' : '\\' + delimiter, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }

  return detectedDelimiter;
}

/**
 * Parses CSV buffer into structured rows and headers.
 * @param {Buffer} buffer 
 * @returns {Promise<{headers: string[], rows: any[], rawData: any[]}>}
 */
export function parseCsv(buffer) {
  return new Promise((resolve, reject) => {
    // Convert buffer to string and strip BOM
    let csvText = buffer.toString('utf8');
    if (csvText.startsWith('\uFEFF')) {
      csvText = csvText.substring(1);
    }

    const firstLine = csvText.split('\n')[0] || '';
    const delimiter = detectDelimiter(firstLine);

    // First, parse as raw array to get headers and all raw cells for preview
    parse(csvText, {
      delimiter,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }, (err, rawData) => {
      if (err) {
        return reject(err);
      }

      if (rawData.length === 0) {
        return resolve({ headers: [], rows: [], rawData: [] });
      }

      const headers = rawData[0].map(h => h || '');
      
      // Parse again mapping to objects for AI processing
      parse(csvText, {
        delimiter,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      }, (err2, rows) => {
        if (err2) {
          // If mapping to objects failed, fallback to manual mapping based on rawData
          const parsedRows = [];
          for (let i = 1; i < rawData.length; i++) {
            const rowObj = {};
            headers.forEach((header, index) => {
              if (header) {
                rowObj[header] = rawData[i][index] || '';
              }
            });
            parsedRows.push(rowObj);
          }
          return resolve({ headers, rows: parsedRows, rawData });
        }
        
        return resolve({ headers, rows, rawData });
      });
    });
  });
}
