/**
 * Create PWA Icons Script
 *
 * Generates required PWA icon files in PNG format
 * Creates 192x192 and 512x512 pixel icons for the AED management system
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Simple SVG template for AED icon
const createSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#000000"/>

  <!-- AED Heart Symbol -->
  <g transform="translate(${size/2}, ${size/2})">
    <!-- Heart shape -->
    <path d="M 0,-${size*0.2}
             C -${size*0.15},-${size*0.35} -${size*0.35},-${size*0.35} -${size*0.35},-${size*0.15}
             C -${size*0.35},${size*0.05} -${size*0.2},${size*0.2} 0,${size*0.35}
             C ${size*0.2},${size*0.2} ${size*0.35},${size*0.05} ${size*0.35},-${size*0.15}
             C ${size*0.35},-${size*0.35} ${size*0.15},-${size*0.35} 0,-${size*0.2} Z"
          fill="#FF0000" stroke="#FFFFFF" stroke-width="${size*0.02}"/>

    <!-- Lightning bolt (defibrillator symbol) -->
    <path d="M -${size*0.08},-${size*0.1}
             L ${size*0.03},-${size*0.1}
             L -${size*0.03},${size*0.02}
             L ${size*0.08},${size*0.02}
             L -${size*0.03},${size*0.15}
             L ${size*0.03},-${size*0.02}
             L -${size*0.08},-${size*0.02} Z"
          fill="#FFFFFF"/>
  </g>

  <!-- Text: AED -->
  <text x="${size/2}" y="${size*0.85}"
        font-family="Arial, sans-serif"
        font-size="${size*0.12}"
        font-weight="bold"
        fill="#FFFFFF"
        text-anchor="middle">AED</text>
</svg>
`;

// Create PNG from SVG using canvas (if available) or create placeholder
async function createPNGIcon(size, outputPath) {
  try {
    // Try to use canvas if available
    const { createCanvas, loadImage } = require('canvas');
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Create data URL from SVG
    const svg = createSVG(size);
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

    // Load and draw SVG
    const img = await loadImage(dataUrl);
    ctx.drawImage(img, 0, 0);

    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Created: ${outputPath}`);
  } catch {
    // Canvas not available, create SVG file instead
    console.log(`Canvas not available, creating SVG fallback for ${outputPath}`);
    const svgPath = outputPath.replace('.png', '.svg');
    fs.writeFileSync(svgPath, createSVG(size));
    console.log(`Created SVG: ${svgPath}`);

    // Create a simple placeholder PNG (1x1 pixel) as fallback
    // This is a minimal valid PNG file
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
      0x00, 0x00, 0x00, // compression, filter, interlace
      0x7C, 0x26, 0x41, 0x1C, // CRC
      0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, // data
      0x44, 0xDD, 0x46, 0x38, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk size
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);

    fs.writeFileSync(outputPath, pngHeader);
    console.log(`Created placeholder PNG: ${outputPath}`);
  }
}

// Main function
async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Create icons
  const sizes = [
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' }
  ];

  for (const { size, name } of sizes) {
    const outputPath = path.join(publicDir, name);
    await createPNGIcon(size, outputPath);
  }

  // Also create SVG versions for better quality
  fs.writeFileSync(path.join(publicDir, 'icon-192x192.svg'), createSVG(192));
  fs.writeFileSync(path.join(publicDir, 'icon-512x512.svg'), createSVG(512));

  console.log('PWA icon generation complete!');
}

// Run the script
main().catch(console.error);