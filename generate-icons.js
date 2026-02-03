// Simple icon generator for GanDash
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVG = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.5}, ${size * 0.5})">
    <path d="M -${size * 0.25} -${size * 0.15} L -${size * 0.25} ${size * 0.25} L -${size * 0.05} ${size * 0.25} L -${size * 0.05} -${size * 0.15} Z" fill="white" opacity="0.95"/>
    <path d="M ${size * 0.05} -${size * 0.25} L ${size * 0.05} ${size * 0.15} L ${size * 0.25} ${size * 0.15} L ${size * 0.25} -${size * 0.25} Z" fill="white" opacity="0.95"/>
    <circle cx="0" cy="${size * 0.05}" r="${size * 0.08}" fill="white" opacity="0.95"/>
  </g>
</svg>`;
};

// Icon sizes needed
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory
const iconsDir = path.join(__dirname, 'frontend', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (we'll use SVG as fallback since we don't have PNG conversion)
sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Created ${filename}`);
});

console.log('\n✅ Icon generation complete!');
console.log('Note: SVG icons created. For production, convert to PNG using:');
console.log('  - Online tool: https://cloudconvert.com/svg-to-png');
console.log('  - Or install imagemagick: sudo apt install imagemagick');
