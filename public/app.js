// app.js

import { initGLProgram, setUpBuffers, drawScene } from './GLProgram.js';
import { resampleData, readProcessedPixels, analyzeProcessedImage } from './imageProcessing.js';

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');
const program = initGLProgram(gl);

// Set up buffers and shaders
setUpBuffers(gl, program);

// Declare imageData globally
let imageData = null;
let hueShiftLocation = null;

// Parameters for interpolation and image processing
let currentData = null;
let targetData = null;
const maxValue = 1000;
const dataResolution = 220;
const interpolationSpeed = 0.01;
const startIndex = 0;
const indexRange = 500;
const inputMin = 0;
const inputMax = 25000;
const outputMin = 1000;
const outputMax = 75000;

// WebSocket connection for data streaming
const ws = new WebSocket('ws://127.0.0.1:3030'); // Use your server's local IP address
ws.onmessage = (event) => {
  const responseData = JSON.parse(event.data);
  const endIndex = startIndex + indexRange;
  const trimmedData = responseData.d.slice(startIndex, endIndex);

  // Scale and resample the data
  const scaledData = trimmedData.map(value => {
    const scaledValue = (((value - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin)) + outputMin;
    return Math.round(scaledValue * 100) / 100;
  });

  targetData = resampleData(scaledData, dataResolution);
  if (!currentData) currentData = targetData.slice(); // Initialize current data on the first run
};

// Continuous interpolation between the current and target data
function continuousInterpolation() {
  if (currentData && targetData && imageData) { // Ensure imageData is loaded
    const interpolatedData = currentData.map((value, index) => {
      return value + (targetData[index] - value) * interpolationSpeed;
    });

    updateImage(interpolatedData);
    currentData = interpolatedData.slice();
  }
  requestAnimationFrame(continuousInterpolation);
}

// Load and bind the texture from the image
const image = new Image();
image.src = './assets/hanikamu_01.4.png'; // Path to your preloaded image
image.onload = () => {
  const canvasTmp = document.createElement('canvas');
  const ctxTmp = canvasTmp.getContext('2d');
  const width = 2200;
  const height = 640;
  canvasTmp.width = width;
  canvasTmp.height = height;
  ctxTmp.drawImage(image, 0, 0, width, height);

  imageData = ctxTmp.getImageData(0, 0, width, height); // Now imageData is defined

  // Create and bind the texture for the image
  const imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Get location for hue shift uniform
  hueShiftLocation = gl.getUniformLocation(program, 'u_hueShift');

  // Start the WebGL rendering loop only after the image is loaded
  continuousInterpolation();
  updateHueShift(); // Start the hue shift animation
};

// Function to update the image and process the pixels
function updateImage(data) {
  const width = 2200;
  const height = 640;
  const stretchedImageData = new Uint8Array(width * height * 4);
  const rowsPerSample = height / data.length;

  for (let y = 0; y < data.length; y++) {
    const value = data[y] / maxValue;
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

  // Bind the texture to WebGL
  const imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, stretchedImageData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Render the scene
  drawScene(gl);

  // Analyze the processed image pixels
  const processedPixels = readProcessedPixels(gl, canvas.width, canvas.height);
  const rowsAnalysis = analyzeProcessedImage(processedPixels, canvas.width, canvas.height, dataResolution);
  console.log(rowsAnalysis);
}

// Function to handle the hue shift animation
function updateHueShift() {
  // Calculate time elapsed in minutes
  const elapsedTime = (Date.now() - startTime) / 60000;
  const hueShift = (elapsedTime / 12) % 1.0;

  // Set the hue shift value in the shader
  if (hueShiftLocation) {
    gl.uniform1f(hueShiftLocation, hueShift);
  }

  // Continue updating the hue shift
  requestAnimationFrame(updateHueShift);
}

let startTime = Date.now(); // Start the hue shift timer
