const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

// Vertex shader for 180-degree rotation
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    // Apply 90-degree counterclockwise rotation
    gl_Position = vec4(-a_position.y, a_position.x, 0, 1); // Rotate 90 degrees counterclockwise
    v_texCoord = vec2(a_texCoord.x, a_texCoord.y); // Keep the texture coordinates as is    
  }
`;

// Fragment shader program
const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_hueShift; // New uniform for hue shift

  // Function to convert RGB to HSV
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  // Function to convert HSV back to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec4 imageColor = texture2D(u_image, v_texCoord);

    // Convert RGB to HSV
    vec3 hsv = rgb2hsv(imageColor.rgb);

    // Shift hue
    hsv.x = mod(hsv.x + u_hueShift, 1.0);

    // Convert back to RGB
    vec3 rgb = hsv2rgb(hsv);

    gl_FragColor = vec4(rgb, imageColor.a);
  }
`;

// Compile shaders
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

// Link shaders into a program
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
  
let program = createProgram(gl, vertexShader, fragmentShader);
gl.useProgram(program);

// Set up position and texture coordinate buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positions = [
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
const texCoords = [
  0, 1,  // Top-left corner
  1, 1,  // Top-right corner
  0, 0,  // Bottom-left corner
  1, 0,  // Bottom-right corner
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
gl.enableVertexAttribArray(texCoordLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

// Set the WebGL viewport to match the canvas size
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(1.0, 1.0, 1.0, 1.0); // Set clear color to white (RGBA)

let imageTexture;
let imageData;
let currentData = null;
let targetData = null;

let maxValue = 1000;
let startIndex = 0;
let indexRange = 500;
let dataResolution = 220;
let interpolationSpeed = 0.01;

let inputMin = 0; 
let inputMax = 25000; 
let outputMin = 1000;
let outputMax = 75000;

// Load and create texture from an image
const image = new Image();
image.src = './assets/hanikamu_01.2.png'; // Path to your preloaded image
image.onload = () => {
  const canvasTmp = document.createElement('canvas');
  const ctxTmp = canvasTmp.getContext('2d');

  const width = 2200;
  const height = 640;

  canvasTmp.width = width;
  canvasTmp.height = height;
  ctxTmp.drawImage(image, 0, 0, width, height);

  imageData = ctxTmp.getImageData(0, 0, width, height);

  // Create and bind texture
  imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  console.log('Image texture loaded');

  drawScene();
  // WebSocket connection
  const ws = new WebSocket('ws://127.0.0.1:3030'); // Use your server's local IP address
  
  ws.onmessage = (event) => {
    const responseData = JSON.parse(event.data);
  
    const endIndex = startIndex + indexRange;
    const trimmedData = responseData.d.slice(startIndex, endIndex);

    const scaledData = trimmedData.map(value => {
      // Scale the value from range(inputMin, inputMax) to range(outputMin, outputMax)
      const scaledValue = (((value - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin)) + outputMin; 
      // Round to the nearest hundredths using Math.round
      return Math.round(scaledValue * 100) / 100;
    });

    targetData = resampleData(scaledData, dataResolution); // Adjust dataResolution if needed
    if (!currentData) currentData = targetData.slice(); // Initialize current data on the first run
  };

  // Continuous interpolation
  function continuousInterpolation() {
    if (currentData && targetData) {
      const interpolatedData = currentData.map((value, index) => {
        return value + (targetData[index] - value) * interpolationSpeed;
      });

      updateImage(interpolatedData, imageData);

      // Update currentData towards targetData
      currentData = interpolatedData.slice();
    }

    requestAnimationFrame(continuousInterpolation);
  }

  continuousInterpolation(); // Start continuous interpolation
};

// Function to resample data using linear interpolation
function resampleData(data, targetLength) {
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

// Function to read the processed pixels from the WebGL canvas
function readProcessedPixels() {
  const width = canvas.width;
  const height = canvas.height;
  const processedImageData = new Uint8Array(width * height * 4); // RGBA for each pixel

  // Read the pixels from the framebuffer
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, processedImageData);

  return processedImageData;
}

// Function to update the image based on data
function updateImage(data, imageData) {
  const width = 2200;
  const height = 640;
  
  const rowsPerSample = height / data.length;

  const stretchedImageData = new Uint8Array(width * height * 4); // Array to hold stretched image data (RGBA for each pixel)
  for (let y = 0; y < data.length; y++) {
    // const value = normalizedData[y]; // Normalized value
    const value = data[y] / maxValue; // Absolute value 
    const startRow = Math.floor(y * rowsPerSample); 
    const endRow = Math.floor((y + 1) * rowsPerSample);
    const rowWidth = Math.floor(width * value);

    for (let row = startRow; row < endRow; row++) {
      for (let x = 0; x < rowWidth; x++) {
        const srcIndex = (row * width + Math.floor(x / value)) * 4;
        const destIndex = (row * width + x) * 4;
        stretchedImageData[destIndex] = imageData.data[srcIndex];
        stretchedImageData[destIndex + 1] = imageData.data[srcIndex + 1];
        stretchedImageData[destIndex + 2] = imageData.data[srcIndex + 2];
        stretchedImageData[destIndex + 3] = imageData.data[srcIndex + 3];
      }
    }
  }

  if (!imageTexture) {
    imageTexture = gl.createTexture();
  }

  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, stretchedImageData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);


  console.log('Stretched image texture updated');

  drawScene();

  // After rendering, read the processed pixels
  const processedPixels = readProcessedPixels();

  // Now analyze the processed pixels
  const rowsAnalysis = analyzeProcessedImage(processedPixels, width, height, dataResolution);
  console.log(rowsAnalysis);
}

let startTime = Date.now();

function updateHueShift() {
  // Calculate time elapsed in minutes
  const elapsedTime = (Date.now() - startTime) / 60000;
  const hueShift = (elapsedTime / 12) % 1.0;

  const hueShiftLocation = gl.getUniformLocation(program, 'u_hueShift');
  gl.uniform1f(hueShiftLocation, hueShift);

  drawScene();

  // Continue updating the hue shift
  requestAnimationFrame(updateHueShift);
}

// Start the hue shift animation
updateHueShift();

// Function to draw the scene
function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Initial draw
drawScene();

// Function to analyze the processed image (read from WebGL after rendering)
function analyzeProcessedImage(processedImageData, width, height, dataResolution) {
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
