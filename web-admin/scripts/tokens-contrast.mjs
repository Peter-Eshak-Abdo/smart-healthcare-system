import process from 'node:process';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = Number.parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const PAIRS = [
  ['light-fg-bg', '#111827', '#F3F4F6', 4.5],
  ['light-card-fg', '#111827', '#FFFFFF', 4.5],
  ['light-primary-btn', '#FFFFFF', '#2563EB', 4.5],
  ['light-destructive-btn', '#FFFFFF', '#DC2626', 4.5],
  ['light-muted-fg', '#4B5563', '#FFFFFF', 4.5],
  ['dark-fg-bg', '#F9FAFB', '#0B1220', 4.5],
  ['dark-card-fg', '#F9FAFB', '#111827', 4.5],
  ['dark-primary-btn', '#0B1220', '#60A5FA', 4.5],
  ['emergency-fg-bg', '#FFFFFF', '#000000', 7.0],
  ['emergency-card', '#FFFFFF', '#1C1C1E', 7.0],
  ['sunlight-fg-bg', '#000000', '#FFFFFF', 7.0],
  ['sunlight-primary', '#FFFFFF', '#0040C1', 7.0],
];

let failed = false;
for (const [name, fg, bg, minRatio] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  if (ratio < minRatio) {
    process.stderr.write(`FAIL ${name}: ${ratio.toFixed(2)} < ${minRatio}\n`);
    failed = true;
  } else {
    process.stdout.write(`PASS ${name}: ${ratio.toFixed(2)} >= ${minRatio}\n`);
  }
}

if (failed) {
  process.exit(1);
}
