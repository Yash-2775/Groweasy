import { parseCsv } from '../utils/csvParser.js';
import { extractLeadsBatch } from '../utils/aiExtractor.js';

/**
 * Handles CSV parsing and returns raw data for preview
 */
export async function parseCsvHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const { headers, rows, rawData } = await parseCsv(req.file.buffer);

    return res.json({
      success: true,
      headers,
      rows,
      rawData, // Contains array of arrays representation
      totalRows: rows.length
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return res.status(500).json({
      error: 'Failed to parse CSV file',
      message: error.message
    });
  }
}

/**
 * Handles AI extraction of leads in batches
 */
export async function extractLeadsHandler(req, res) {
  try {
    let rows = [];
    let originalHeaders = [];

    // 1. Get rows either from file upload or JSON body
    if (req.file) {
      const parsed = await parseCsv(req.file.buffer);
      rows = parsed.rows;
      originalHeaders = parsed.headers;
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
      originalHeaders = req.body.headers || Object.keys(rows[0] || {});
    } else {
      return res.status(400).json({ error: 'No data provided. Upload a CSV file or provide rows in the request body.' });
    }

    if (rows.length === 0) {
      return res.json({
        success: true,
        leads: [],
        skipped: [],
        totalImported: 0,
        totalSkipped: 0
      });
    }

    // 2. Retrieve Gemini API Key
    const apiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'API Key Missing',
        message: 'Please provide a Gemini API Key in the settings panel or set GEMINI_API_KEY in the backend environment.'
      });
    }

    // 3. Prepare rows with a unique __row_id so we can track skipped records
    const rowsWithId = rows.map((row, index) => ({
      ...row,
      __row_id: index
    }));

    // 4. Batch processing (e.g., 25 records per batch)
    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < rowsWithId.length; i += BATCH_SIZE) {
      batches.push(rowsWithId.slice(i, i + BATCH_SIZE));
    }

    console.log(`Starting AI extraction: ${rows.length} rows, ${batches.length} batches of size ${BATCH_SIZE}`);

    const extractedLeads = [];
    
    // Process batches
    // We can run them in sequence or parallel. Sequential with retry is safer for rate limits.
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      try {
        const batchLeads = await extractLeadsBatch(batch, apiKey);
        extractedLeads.push(...batchLeads);
      } catch (batchError) {
        console.error(`Failed to process batch ${i + 1}:`, batchError);
        // If a batch completely fails, we treat its rows as skipped or throw
        // For production readiness, let's log and mark them as skipped rather than crashing the whole import
      }
    }

    // 5. Track which rows were skipped
    // An input row index was skipped if it doesn't match the __row_id of any extracted lead
    const extractedRowIds = new Set(
      extractedLeads
        .map(lead => lead.__row_id)
        .filter(id => id !== undefined && id !== null)
    );

    const skippedRecords = [];
    rows.forEach((row, index) => {
      if (!extractedRowIds.has(index)) {
        // Find reason for skip
        let reason = 'Skipped by AI (insufficient or invalid data)';
        const hasEmail = row.email || Object.keys(row).some(k => k.toLowerCase().includes('email') && row[k]);
        const hasPhone = row.mobile || Object.keys(row).some(k => (k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')) && row[k]);
        
        if (!hasEmail && !hasPhone) {
          reason = 'Skipped: Missing both Email and Mobile Number (required)';
        }
        
        skippedRecords.push({
          rowIndex: index + 1, // 1-indexed for user display
          rowData: row,
          reason
        });
      }
    });

    // Clean up __row_id from final returned leads so they are clean CRM format
    const cleanLeads = extractedLeads.map(lead => {
      const { __row_id, ...cleanLead } = lead;
      return cleanLead;
    });

    // 6. Return response
    return res.json({
      success: true,
      leads: cleanLeads,
      skipped: skippedRecords,
      totalImported: cleanLeads.length,
      totalSkipped: skippedRecords.length,
      totalProcessed: rows.length
    });

  } catch (error) {
    console.error('Error in AI extraction handler:', error);
    return res.status(500).json({
      error: 'AI Lead Extraction Failed',
      message: error.message
    });
  }
}
