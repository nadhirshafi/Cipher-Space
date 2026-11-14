import * as THREE from 'three';

export function createStarfield() {
  const starsGroup = new THREE.Group();
  starsGroup.name = 'Starfield';

  // Create soft round star particle texture
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(230, 240, 255, 0.8)');
  grad.addColorStop(0.7, 'rgba(180, 200, 255, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const starTexture = new THREE.CanvasTexture(canvas);

  const starCount = 6000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const colorPalettes = [
    new THREE.Color(0xffffff), // Bright white
    new THREE.Color(0xbfe0ff), // Blue-white
    new THREE.Color(0xfff1d6), // Warm yellowish
    new THREE.Color(0xffd1a4), // Orange giant
    new THREE.Color(0x99bbff)  // Deep electric blue
  ];

  for (let i = 0; i < starCount; i++) {
    // Distribute on a spherical shell between radius 700 and 1400
    const radius = 700 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Pick random star spectrum
    const c = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    // Size variance (most small, occasional bright beacons)
    sizes[i] = Math.random() < 0.05 ? 3.5 + Math.random() * 2.5 : 1.2 + Math.random() * 1.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 2.2,
    map: starTexture,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const starPoints = new THREE.Points(geometry, material);
  starsGroup.add(starPoints);

  return starsGroup;
}
