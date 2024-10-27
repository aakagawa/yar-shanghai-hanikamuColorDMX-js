// app.js

import { initGLProgram, setUpBuffers, drawScene } from './GLProgram.js';
import { resampleData, readProcessedPixels, analyzeProcessedImage } from './imageProcessing.js';
import { convertRGBtoRGBW, assignDMXData, applyBrightness, applySaturation } from './dmx.js';

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');
const program = initGLProgram(gl);

// Set up buffers and shaders
setUpBuffers(gl, program);

// Declare imageData globally
let imageData = null;
let hueShiftLocation = null;
let ws = null;  // Declare WebSocket variable globallys

// DMX Universes and Channels for RGBW values
const universeBottomCells = { 2: new Uint8Array(512), 0: new Uint8Array(512) };  // Universes for bottom cells
const universeTopCells = { 3: new Uint8Array(512), 1: new Uint8Array(512) };     // Universes for top cells

// Parameters for interpolation and image processing
let currentData = null;
let targetData = null;
let maxValue = 1000;
let startIndex = 0;
let indexRange = 510;
let inputMin = 0;
let inputMax = 25000;
let outputMin = 1000;
let outputMax = 75000;
let dataResolution = 220;
let interpolationSpeed = 0.01;

// Parameters for dmx values preparation 
let brightnessFactor = 1.0; // Initialize user-adjustable brightness factor
let saturationFactor = 1.0; 

let startTime = Date.now(); //

// Open the WebSocket connection once
function openWebSocket() {
  ws = new WebSocket('ws://127.0.0.1:3030');

  ws.onopen = () => console.log('WebSocket connection opened');
  ws.onclose = () => console.log('WebSocket connection closed');
  ws.onerror = (error) => console.error('WebSocket error:', error);

  // Receive messages from the server
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
}

// Function to send DMX data in sequence, independently of requestAnimationFrame
function sendDMXUniverse() {
  const universes = [
    { universe: 2, data: universeBottomCells[2] },
    { universe: 0, data: universeBottomCells[0] },
    { universe: 3, data: universeTopCells[3] },
    { universe: 1, data: universeTopCells[1] },
  ];

  let index = 0;

  function sendNextUniverse() {
    const { universe, data } = universes[index];
    sendToServer(universe, data);
    index = (index + 1) % universes.length; // Loop back to the start
  }

  // Send each universe in sequence every 25ms
  setInterval(sendNextUniverse, 25);
}

// Function to send DMX data to the server
function sendToServer(universe, dmxData) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`Sending DMX data to Universe ${universe}:`, Array.from(dmxData).slice(0, 16));
    ws.send(JSON.stringify({ universe, channels: Array.from(dmxData) }));
  } else {
    console.error('WebSocket is not open. Unable to send data.');
  }
}

// Continuous interpolation between the current and target data
function continuousInterpolation() {
  if (currentData && targetData && imageData) { // Ensure imageData is loaded
    const interpolatedData = currentData.map((value, index) => {
      return value + (targetData[index] - value) * (Math.round(interpolationSpeed * 1000) / 1000); //
        // Math.round(scaledValue * 100) / 100;
    });

    updateImage(interpolatedData);
    currentData = interpolatedData.slice();
  }
  requestAnimationFrame(continuousInterpolation);
}

// Function to handle the hue shift animation
function updateHueShift() {
  // Calculate time elapsed in minutes
  const elapsedTime = (Date.now() - startTime) / 60000;
  const hueShift = (elapsedTime / 1) % 1.0;

  // Set the hue shift value in the shader
  if (hueShiftLocation) {
    gl.uniform1f(hueShiftLocation, hueShift);
  }

  // Continue updating the hue shift
  requestAnimationFrame(updateHueShift);
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
  continuousInterpolation(); // Start data interpolation
  updateHueShift(); // Start hue shift animation
  sendDMXUniverse(); // Start sending DMX 
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

  // Loop through each column, process the data
  rowsAnalysis.forEach((columnData, index) => {
    // Convert bottom and top cell colors to RGBW
    const bottomRGBW = convertRGBtoRGBW(columnData.bottomCellColor.r, columnData.bottomCellColor.g, columnData.bottomCellColor.b);
    const topRGBW = convertRGBtoRGBW(columnData.topCellColor.r, columnData.topCellColor.g, columnData.topCellColor.b);

    // Apply brightness and saturation to bottom and top cell values
    const bottomRGBWWithBrightness = applyBrightness(bottomRGBW, columnData.bottomPercentage, brightnessFactor);
    const bottomRGBWFinal = applySaturation(bottomRGBWWithBrightness, saturationFactor);

    const topRGBWWithBrightness = applyBrightness(topRGBW, columnData.topPercentage, brightnessFactor);
    const topRGBWFinal = applySaturation(topRGBWWithBrightness, saturationFactor);

    // Assign values to DMX universes
    assignDMXData(universeBottomCells, universeTopCells, index, bottomRGBWFinal, topRGBWFinal);
  });
}

// Open the WebSocket connection when the app starts
openWebSocket();

// GUI

document.addEventListener('keydown', (event) => {
  if (event.key === 'g') { 
    guiVisible = !guiVisible;
    if(!guiVisible) {
      hideGUI();
    }
  } else if (guiVisible) {
    if (event.key === 'ArrowUp') {
      selectedParameter = (selectedParameter - 1 + 11) % 11; // 11 parameters in total 
    } else if (event.key === 'ArrowDown') {
      selectedParameter = (selectedParameter + 1) % 11;
    } else if (event.key === 'ArrowRight') {
      adjustParameter(1);
    } else if (event.key === 'ArrowLeft') {
      adjustParameter(-1);
    }
  } else if (event.key === 's') {
    saveSettings();
  } else if (event.key === 'd') {
    loadDefaultSettings();
  }
});

window.addEventListener('load', loadSettings);

let guiVisible = false; 
let selectedParameter = 0; // Track the selected parameter 

function adjustParameter(delta) {
  switch (selectedParameter) {
    case 0: maxValue += delta * 500; break;
    case 1: startIndex += delta * 10; break;
    case 2: indexRange += delta * 10; break;
    case 3: inputMin += delta * 500; break;
    case 4: inputMax += delta * 500; break;
    case 5: outputMin += delta * 500; break;
    case 6: outputMax += delta * 500; break;
    case 7: dataResolution += delta * 1; break;
    case 8: interpolationSpeed += delta * 0.001; break;
    case 9: brightnessFactor += delta * 0.01; break;
    case 10: saturationFactor += delta * 0.01; break;
  }
}

function displayGUI() {
  if (guiVisible) {
    const params = [
      `maxValue: ${maxValue}`,
      `startIndex: ${startIndex}`,
      `indexRange: ${indexRange}`,
      `inputMin: ${inputMin}`,
      `inputMax: ${inputMax}`,
      `outputMin: ${outputMin}`,
      `outputMax: ${outputMax}`,
      `dataResolution: ${dataResolution}`,
      `interpolationSpeed: ${interpolationSpeed.toFixed(3)}`,
      `brightnessFactor: ${brightnessFactor.toFixed(2)}`,
      `saturationFactor: ${saturationFactor.toFixed(2)}`,
    ];

    const guiElement = document.getElementById('gui');
    guiElement.innerHTML = params.map((param, i) =>
      `<div ${i === selectedParameter ? 'style="color: white;"' : ''}>${param}</div>`
    ).join('');
  }
  requestAnimationFrame(displayGUI);
}

function hideGUI() {
  const guiElement = document.getElementById('gui');
  guiElement.innerHTML = ''; // Clear the GUI content to hide it
}

function saveSettings() {
  const settings = {
    maxValue,
    startIndex,
    indexRange,
    inputMin,
    inputMax,
    outputMin,
    outputMax,
    dataResolution,
    interpolationSpeed,
    brightnessFactor,
    saturationFactor,
  };
  localStorage.setItem('settings', JSON.stringify(settings)); // Store settings in localStorage
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('settings'));
  if (settings) {
    maxValue = settings.maxValue;
    startIndex = settings.startIndex;
    indexRange = settings.indexRange;
    inputMin = settings.inputMin;  
    inputMax = settings.inputMax;
    outputMin = settings.outputMin;
    outputMax = settings.outputMax;
    dataResolution = settings.dataResolution;
    interpolationSpeed = settings.interpolationSpeed;
    brightnessFactor = settings.brightnessFactor;
    saturationFactor = settings.saturationFactor;
  } else {
    loadDefaultSettings(); // If no previous settings, load defaults
  }
}

function loadDefaultSettings() {
  maxValue = 1000;
  startIndex = 0;
  indexRange = 510;
  inputMin = 0;
  inputMax = 25000;
  outputMin = 1000;
  outputMax = 75000;
  dataResolution = 220; 
  interpolationSpeed = 0.01;
  brightnessFactor = 1.0;
  saturationFactor = 1.0
}

displayGUI();