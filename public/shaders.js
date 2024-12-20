// shaders.js

export function createShader(gl, type, source) {
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

// Vertex shader for 180-degree rotation
export const vertexShaderSource = `
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
export const fragmentShaderSource = `
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
