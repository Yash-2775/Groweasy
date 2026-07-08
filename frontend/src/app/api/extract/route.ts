import { NextRequest, NextResponse } from 'next/server';
import { parseCSVClient } from '../../../utils/csvParser';
import { extractLeadsBatch } from '../../../utils/aiExtractor';

export async function POST(req: NextRequest) {
  try {
    let rows: any[] = [];
    let headers: string[] = [];

    const contentType = req.headers.get('content-type') || '';
    const apiKey = req.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'API Key Missing',
        message: 'Please provide a Gemini API Key in the settings panel or set GEMINI_API_KEY in the environment.'
      }, { status: 400 });
    }

    // 1. Parse rows either from file upload (form data) or raw JSON body
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      const text = await file.text();
      const parsed = parseCSVClient(text);
      rows = parsed.rows;
      headers = parsed.headers;
    } else {
      const body = await req.json();
      rows = body.rows;
      headers = body.headers || Object.keys(rows[0] || {});
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        leads: [],
        skipped: [],
        totalImported: 0,
        totalSkipped: 0
      });
    }

    // 2. Prepare rows with unique ids to track skips
    const rowsWithId = rows.map((row, index) => ({
      ...row,
      __row_id: index
    }));

    // 3. Process the rows in batches of 25 (Sequential to prevent rate limits)
    const BATCH_SIZE = 25;
    const batches: any[][] = [];
    for (let i = 0; i < rowsWithId.length; i += BATCH_SIZE) {
      batches.push(rowsWithId.slice(i, i + BATCH_SIZE));
    }

    const extractedLeads: any[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const batchLeads = await extractLeadsBatch(batch, apiKey);
        extractedLeads.push(...batchLeads);
      } catch (batchError: any) {
        console.error(`Next.js API Failed to process batch ${i + 1}:`, batchError);
        // If a batch fails, we record the error but continue to other batches
      }
    }

    // 4. Calculate which rows were skipped
    const extractedRowIds = new Set(
      extractedLeads
        .map(lead => lead.__row_id)
        .filter(id => id !== undefined && id !== null)
    );

    const skippedRecords: any[] = [];
    rows.forEach((row, index) => {
      if (!extractedRowIds.has(index)) {
        let reason = 'Skipped by AI (insufficient or invalid data)';
        
        // Check if phone or email columns contain values
        const hasEmail = row.email || Object.keys(row).some(k => k.toLowerCase().includes('email') && row[k]);
        const hasPhone = row.mobile || Object.keys(row).some(k => (k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')) && row[k]);
        
        if (!hasEmail && !hasPhone) {
          reason = 'Skipped: Missing both Email and Mobile Number (required)';
        }
        
        skippedRecords.push({
          rowIndex: index + 1, // 1-indexed for display
          rowData: row,
          reason
        });
      }
    });

    // Remove the temporary row ID from the final CRM schema output
    const cleanLeads = extractedLeads.map(lead => {
      const { __row_id, ...cleanLead } = lead;
      return cleanLead;
    });

    return NextResponse.json({
      success: true,
      leads: cleanLeads,
      skipped: skippedRecords,
      totalImported: cleanLeads.length,
      totalSkipped: skippedRecords.length,
      totalProcessed: rows.length
    });

  } catch (error: any) {
    console.error('Error in extract api route:', error);
    return NextResponse.json({
      error: 'AI Lead Extraction Failed',
      message: error.message || 'Something went wrong'
    }, { status: 500 });
  }
}
