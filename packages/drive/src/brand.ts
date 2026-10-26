// The colour of a drive's brand, given as one #rrggbb: the shades the
// interface uses made of it, for the light theme and, lighter, for the dark,
// with the ink on it black or white, whichever reads.

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** How well the colour reads on white, as WCAG counts it: 4.5 or more for text. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** The custom properties of the drive made of `brand`, for the drive that `scope` selects. */
export function brandStyle(scope: string, brand: string): string {
  const ink = luminance(brand) > 0.18 ? '#111' : '#fff';
  const light = `--rf-brand: ${brand}; --rf-brand-hover: color-mix(in srgb, ${brand} 80%, #000); --rf-brand-light: color-mix(in srgb, ${brand} 12%, #fff); --rf-focus: color-mix(in srgb, ${brand} 45%, #fff); --rf-on-brand: ${ink};`;
  const dark = `--rf-brand: color-mix(in srgb, ${brand} 55%, #fff); --rf-brand-hover: color-mix(in srgb, ${brand} 35%, #fff); --rf-brand-light: color-mix(in srgb, ${brand} 28%, #161514); --rf-focus: color-mix(in srgb, ${brand} 70%, #000); --rf-on-brand: #111;`;
  return `${scope} { ${light} }\n${scope}[data-theme='dark'] { ${dark} }\n@media (prefers-color-scheme: dark) { ${scope}[data-theme='auto'] { ${dark} } }`;
}
