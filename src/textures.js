import * as THREE from 'three';

/**
 * Procedural texture generators for space simulation PBR materials.
 */

// 1. Procedural Wrinkled Gold Foil (Mylar Thermal Blanket)
export function createGoldFoilTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base gold/amber gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#f5b041');
  grad.addColorStop(0.3, '#f39c12');
  grad.addColorStop(0.7, '#d68910');
  grad.addColorStop(1, '#b7950b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Generate wrinkled noise lines and facets (creased foil look)
  ctx.strokeStyle = 'rgba(255, 235, 150, 0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 10 + Math.random() * 35;
    const angle = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Dark crease shadows
  ctx.strokeStyle = 'rgba(80, 45, 5, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 8 + Math.random() * 30;
    const angle = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Quilted/grid seams often found on satellite thermal blankets
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
  ctx.lineWidth = 2;
  const gridSize = 64;
  for (let x = 0; x <= 512; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Small rivet dots at intersections
  ctx.fillStyle = '#fceecb';
  for (let x = 0; x <= 512; x += gridSize) {
    for (let y = 0; y <= 512; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 2. Procedural Solar Panel Cells Texture
export function createSolarPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Deep space-grade silicon cell blue/black background
  ctx.fillStyle = '#08142b';
  ctx.fillRect(0, 0, 1024, 512);

  const cols = 8;
  const rows = 4;
  const cellWidth = 1024 / cols;
  const cellHeight = 512 / rows;
  const padding = 5;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = c * cellWidth + padding;
      const y = r * cellHeight + padding;
      const w = cellWidth - padding * 2;
      const h = cellHeight - padding * 2;

      // Cell body with subtle crystalline gradient
      const cellGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      cellGrad.addColorStop(0, '#0c234a');
      cellGrad.addColorStop(0.5, '#143c7d');
      cellGrad.addColorStop(1, '#091c3b');
      ctx.fillStyle = cellGrad;
      ctx.fillRect(x, y, w, h);

      // Chamfered / rounded silicon wafer corners
      ctx.fillStyle = '#050c1b';
      const cut = 8;
      // top-left
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cut, y);
      ctx.lineTo(x, y + cut);
      ctx.fill();
      // top-right
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w - cut, y);
      ctx.lineTo(x + w, y + cut);
      ctx.fill();
      // bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + cut, y + h);
      ctx.lineTo(x, y + h - cut);
      ctx.fill();
      // bottom-right
      ctx.beginPath();
      ctx.moveTo(x + w, y + h);
      ctx.lineTo(x + w - cut, y + h);
      ctx.lineTo(x + w, y + h - cut);
      ctx.fill();

      // Silver conductive micro-grid lines (fingers)
      ctx.strokeStyle = 'rgba(180, 210, 255, 0.35)';
      ctx.lineWidth = 1;
      const lines = 12;
      for (let l = 1; l < lines; l++) {
        const lineX = x + (w / lines) * l;
        ctx.beginPath();
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + h);
        ctx.stroke();
      }

      // Main silver busbars (horizontal)
      ctx.strokeStyle = 'rgba(235, 245, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.33);
      ctx.lineTo(x + w, y + h * 0.33);
      ctx.moveTo(x, y + h * 0.67);
      ctx.lineTo(x + w, y + h * 0.67);
      ctx.stroke();
    }
  }

  // Outer panel border frame
  ctx.strokeStyle = '#3a4454';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 506);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 3. Procedural Earth Surface Texture (Continents, Oceans, Ice Caps)
export function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Deep Ocean Blue Base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanGrad.addColorStop(0, '#0a2342');
  oceanGrad.addColorStop(0.5, '#051b36');
  oceanGrad.addColorStop(1, '#0a2342');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Continental Landmasses (using organic perlin-like noise blobs)
  function drawContinent(cx, cy, rx, ry, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const noise = 0.75 + Math.sin(angle * 4) * 0.15 + Math.cos(angle * 7) * 0.1;
      const x = cx + Math.cos(angle) * rx * noise;
      const y = cy + Math.sin(angle) * ry * noise;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw recognizable major continental groupings across equirectangular projection
  // North America
  drawContinent(500, 360, 240, 160, '#2b4d2f');
  drawContinent(460, 320, 160, 100, '#3e6b36');
  // South America
  drawContinent(680, 680, 140, 220, '#1f4e27');
  // Eurasia
  drawContinent(1240, 340, 420, 190, '#365330');
  drawContinent(1450, 400, 250, 140, '#4a673c');
  // Africa
  drawContinent(1100, 560, 200, 230, '#596932');
  drawContinent(1120, 470, 160, 100, '#9c7b41'); // Sahara Desert
  // Australia
  drawContinent(1680, 720, 140, 110, '#8c6031');
  // Greenlands & Polar Ice Caps
  drawContinent(780, 140, 120, 70, '#e5ecf4');
  // Antarctica
  ctx.fillStyle = '#f0f5fa';
  ctx.fillRect(0, 930, 2048, 94);
  // Arctic
  ctx.fillRect(0, 0, 2048, 70);

  // Soft Coastal Shallows / Coral Shelves
  ctx.strokeStyle = 'rgba(40, 150, 180, 0.4)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Desert / Topography detail
  ctx.fillStyle = 'rgba(190, 160, 90, 0.25)';
  ctx.fillRect(350, 380, 120, 60);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 4. Procedural Cloud Layer Texture (Soft swirling clouds with transparency)
export function createEarthCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, 2048, 1024);

  // Swirling weather patterns / cloud bands
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 2048;
    const y = 80 + Math.random() * 860;
    const rad = 25 + Math.random() * 95;
    const alpha = 0.2 + Math.random() * 0.45;

    const cloudGrad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    cloudGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    cloudGrad.addColorStop(0.6, `rgba(255, 255, 255, ${alpha * 0.5})`);
    cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = cloudGrad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Major tropical cyclonic swirls
  function drawCyclone(cx, cy, radius) {
    ctx.save();
    for (let r = 10; r < radius; r += 8) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 - r / radius * 0.3})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, (r * 0.1), (r * 0.1) + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCyclone(600, 400, 120);
  drawCyclone(1400, 650, 150);
  drawCyclone(900, 300, 100);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 5. Procedural Normal / Bump Map for Gold Foil
export function createBumpMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 4 + Math.random() * 20;
    const h = 4 + Math.random() * 20;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#222222';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
