import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PDF_RELATIVE_PATH = path.join(
  'docs',
  '★자동심장충격기+설치+및+관리+지침(제7판)_최종.pdf'
);

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), PDF_RELATIVE_PATH);
    const fileBuffer = await fs.readFile(filePath);

    return new Response(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': 'inline; filename="aed-guidelines-7th.pdf"',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    console.error('Failed to load AED guideline PDF', error);
    return new NextResponse('Not found', { status: 404 });
  }
}
