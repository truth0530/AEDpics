#!/usr/bin/env node

/**
 * PWA 아이콘 생성 스크립트
 * favicon.svg를 사용하여 192x192, 512x512 PNG 아이콘 생성
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sizes = [
  { width: 192, height: 192, name: 'icon-192x192.png' },
  { width: 512, height: 512, name: 'icon-512x512.png' }
];

async function generateIcons() {
  try {
    const svgPath = join(projectRoot, 'public', 'favicon.svg');
    const svgBuffer = readFileSync(svgPath);

    console.log('Generating PWA icons from favicon.svg...\n');

    for (const size of sizes) {
      const outputPath = join(projectRoot, 'public', size.name);

      await sharp(svgBuffer)
        .resize(size.width, size.height, {
          fit: 'contain',
          background: { r: 34, g: 197, b: 94, alpha: 1 } // #22c55e green
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated: ${size.name} (${size.width}x${size.height})`);
    }

    console.log('\n✅ All PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
