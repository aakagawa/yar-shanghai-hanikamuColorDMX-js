// dmx.js 

export function convertRGBtoRGBW(r, g, b) {
  const w = Math.min(r, g, b);
  return { 
    r: r - w, 
    g: g - w, 
    b: b - w, 
    w: w 
  };
}

export function applyBrightness(rgbw, percentage, brightnessFactor) { 
  const factor = (percentage / 100) * brightnessFactor; 
  return {
    r: Math.round(rgbw.r * factor),
    g: Math.round(rgbw.g * factor), 
    b: Math.round(rgbw.b * factor),
    w: Math.round(rgbw.w * factor)
  };
}

export function applySaturation(rgbw, saturationFactor) {
  const hsl = rgbToHsl(rgbw.r, rgbw.g, rgbw.b);

  hsl.s *= saturationFactor;
  hsl.s = Math.max(0, Math.min(1, hsl.s)); // Clamp the saturation to the interval [0, 1]

  const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);

  return { r, g, b, w: rgbw.w };
}

function rgbToHsl(r, g, b) {
  r /= 255, g /= 255, b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
      h = s = 0; // achromatic
  } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
      r = g = b = l; // achromatic
  } else {
      function hue2rgb(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
      }

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// Assign RGBW values to DMX channels with updated universe/channel mapping
export function assignDMXData(universeBottomCells, universeTopCells, index, bottomRGBW, topRGBW) {
  // Assign bottom cell RGBW values to Universes 2 and 0
  if (index < 104) {
    // Universe 2 for bottom cells, indices 0-103
    assignToUniverse(universeBottomCells[2], index, bottomRGBW);
  } else {
    // Universe 0 for bottom cells, indices 104-219
    assignToUniverse(universeBottomCells[0], index - 104, bottomRGBW);
  }

  // Assign top cell RGBW values to Universes 3 and 1 with reversed mapping
  if (index < 104) {
    // Universe 3 for top cells, indices 103-0 (reverse order)
    assignToUniverse(universeTopCells[3], 103 - index, topRGBW);
  } else {
    // Universe 1 for top cells, indices 219-104 (reverse order)
    assignToUniverse(universeTopCells[1], 219 - index, topRGBW);
  }
}

// Helper function to assign RGBW values to the specified universe channels
function assignToUniverse(universe, index, rgbw) {
  const baseChannel = index * 4;

  universe[baseChannel + 0] = rgbw.r;
  universe[baseChannel + 1] = rgbw.g;
  universe[baseChannel + 2] = rgbw.b;
  universe[baseChannel + 3] = rgbw.w;
}
