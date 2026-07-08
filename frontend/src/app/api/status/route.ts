import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  return NextResponse.json({
    success: true,
    hasApiKey
  });
}
