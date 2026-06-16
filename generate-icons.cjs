#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

const resourcesDir = path.join(__dirname, 'resources');
const svgPath = path.join(resourcesDir, 'icon.svg');
const pngPath = path.join(resourcesDir, 'icon.png');
const icoPath = path.join(resourcesDir, 'icon.ico');

if (!fs.existsSync(svgPath)) {
  console.error(`❌ Missing ${svgPath}`);
  console.error('   Add resources/icon.svg first.');
  process.exit(1);
}

async function main() {
  fs.mkdirSync(resourcesDir, { recursive: true });

  const svgBuffer = fs.readFileSync(svgPath);

  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const tempPngPaths = [];

  for (const size of icoSizes) {
    const sizedPath = path.join(resourcesDir, `icon.${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(sizedPath);
    tempPngPaths.push(sizedPath);
  }

  const icoBuffer = await pngToIco(tempPngPaths);
  fs.writeFileSync(icoPath, icoBuffer);

  for (const p of tempPngPaths) {
    try {
      fs.unlinkSync(p);
    } catch {
      // ignore temporary file cleanup errors
    }
  }

  const pngSize = fs.statSync(pngPath).size;
  const icoSize = fs.statSync(icoPath).size;
  console.log(`✅ Created ${pngPath} (${pngSize} bytes) from ${svgPath}`);
  console.log(`✅ Created ${icoPath} (${icoSize} bytes) from ${svgPath}`);
}

main().catch((err) => {
  console.error('❌ Failed to generate icons from SVG:', err);
  process.exit(1);
});
