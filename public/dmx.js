// dmx.js 

export function convertRGBtoRGBW(r, g, b) {
  const w = Math.min(r, g, b);
  return { 
    r: r,//- w, 
    g: g,//- w, 
    b: b,//- w, 
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
  const avg = (rgbw.r + rgbw.g + rgbw.b) / 3;
  return {
    r: Math.round(avg + (rgbw.r - avg) * saturationFactor),
    g: Math.round(avg + (rgbw.g - avg) * saturationFactor),
    b: Math.round(avg + (rgbw.b - avg) * saturationFactor),
    w: rgbw.w
  };
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
