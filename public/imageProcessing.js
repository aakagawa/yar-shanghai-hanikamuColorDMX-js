// imageProcessing.js

export function resampleData(data, targetLength) {
  const resampledData = new Array(targetLength);
  const factor = (data.length - 1) / (targetLength - 1);
  for (let i = 0; i < targetLength; i++) {
    const pos = i * factor;
    const low = Math.floor(pos);
    const high = Math.ceil(pos);
    const weight = pos - low;
    resampledData[i] = (1 - weight) * data[low] + weight * data[high];
  }
  return resampledData;
}
  
export function readProcessedPixels(gl, width, height) {
  const processedImageData = new Uint8Array(width * height * 4); // RGBA for each pixel

  // Read the pixels from the framebuffer
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, processedImageData);
  return processedImageData;
}
  
export function analyzeProcessedImage(processedImageData, width, height, dataResolution) {
  const columns = []; // Now treat what was rows as columns
  
  for (let col = 0; col < dataResolution; col++) {
    const colIndex = Math.floor(col * (width / dataResolution)); // Scale the column index

    // Get the topmost (first) and bottommost (last) pixels in the column
    const topCellIndex = (0 * width + colIndex) * 4; // First pixel in the column (top)
    const bottomCellIndex = ((height - 1) * width + colIndex) * 4; // Last pixel in the column (bottom)

    const topCellColor = {
      r: processedImageData[topCellIndex],
      g: processedImageData[topCellIndex + 1],
      b: processedImageData[topCellIndex + 2],
    };

    const bottomCellColor = {
      r: processedImageData[bottomCellIndex],
      g: processedImageData[bottomCellIndex + 1],
      b: processedImageData[bottomCellIndex + 2],
    };

    let topCloserCount = 0;
    let bottomCloserCount = 0;

    // Iterate through all pixels in the column
    for (let y = 0; y < height; y++) {
      const pixelIndex = (y * width + colIndex) * 4;
      const pixelColor = {
        r: processedImageData[pixelIndex],
        g: processedImageData[pixelIndex + 1],
        b: processedImageData[pixelIndex + 2],
      };

      // Calculate distance to the top and bottom cells
      const distToTop = calculateDistance(pixelColor, topCellColor);
      const distToBottom = calculateDistance(pixelColor, bottomCellColor);

      // Increment the closer count
      if (distToTop < distToBottom) {
        topCloserCount++;
      } else {
        bottomCloserCount++;
      }
    }

    const topPercentage = (topCloserCount / height) * 100;
    const bottomPercentage = (bottomCloserCount / height) * 100;

    columns.push({
      column: colIndex,
      topPercentage,
      bottomPercentage,
      topCellColor,
      bottomCellColor,
    });
  }

  return columns;
}

// Helper function to calculate Euclidean distance in RGB space
function calculateDistance(color1, color2) {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
    Math.pow(color1.g - color2.g, 2) +
    Math.pow(color1.b - color2.b, 2)
  );
}
