import { NextRequest, NextResponse } from 'next/server';
import { parseCSVClient } from '../../../utils/csvParser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCSVClient(text);

    return NextResponse.json({
      success: true,
      headers: parsed.headers,
      rows: parsed.rows,
      rawData: parsed.rawData,
      totalRows: parsed.rows.length
    });
  } catch (error: any) {
    console.error('Error in parse api route:', error);
    return NextResponse.json({
      error: 'Failed to parse CSV file',
      message: error.message || 'Something went wrong'
    }, { status: 500 });
  }
}
