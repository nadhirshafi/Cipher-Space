import * as THREE from 'three';
import { createEarthTexture, createEarthCloudTexture } from './textures.js';

export function createEarthEnvironment() {
  const envGroup = new THREE.Group();
  envGroup.name = 'EarthEnvironment';

  // Earth scale and positioning
  // The satellite is at origin (0, 0, 0)
  // Earth is a giant sphere below and slightly behind in orbit
  const earthRadius = 450;
  const earthPosition = new THREE.Vector3(40, -470, -120);

  // 1. Earth Surface Mesh
  const earthTex = createEarthTexture();
  const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 0.65,
    metalness: 0.15
  });

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.position.copy(earthPosition);
  earthMesh.rotation.z = 0.41; // 23.5 degree axial tilt
  earthMesh.receiveShadow = true;
  envGroup.add(earthMesh);

  // 2. Cloud Layer
  const cloudTex = createEarthCloudTexture();
  const cloudGeo = new THREE.SphereGeometry(earthRadius + 2.5, 64, 64);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.NormalBlending,
    depthWrite: false
  });

  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.position.copy(earthPosition);
  cloudMesh.rotation.z = 0.41;
  envGroup.add(cloudMesh);

  // 3. Atmospheric Rim Glow (Fresnel Shader)
  const atmosphereVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const atmosphereFragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
      gl_FragColor = vec4(0.2, 0.6, 1.0, 1.0) * intensity * 1.8;
    }
  `;

  const atmoGeo = new THREE.SphereGeometry(earthRadius + 6.0, 64, 64);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });

  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  atmoMesh.position.copy(earthPosition);
  envGroup.add(atmoMesh);

  // 4. Directional Sun Light (Harsh Space Sun)
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  sunLight.position.set(300, 200, 250);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 800;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  envGroup.add(sunLight);

  // Visual Sun Disc in the distance
  const sunDiscGeo = new THREE.SphereGeometry(15, 32, 32);
  const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  sunDisc.position.copy(sunLight.position).multiplyScalar(2.5);
  envGroup.add(sunDisc);

  // Sun Corona Glow (Sprite)
  const sunGlowCanvas = document.createElement('canvas');
  sunGlowCanvas.width = 256;
  sunGlowCanvas.height = 256;
  const sCtx = sunGlowCanvas.getContext('2d');
  const sunGrad = sCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sunGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  sunGrad.addColorStop(0.2, 'rgba(255, 240, 200, 0.7)');
  sunGrad.addColorStop(0.5, 'rgba(255, 200, 120, 0.25)');
  sunGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
  sCtx.fillStyle = sunGrad;
  sCtx.fillRect(0, 0, 256, 256);
  const sunGlowTex = new THREE.CanvasTexture(sunGlowCanvas);

  const sunSpriteMat = new THREE.SpriteMaterial({
    map: sunGlowTex,
    blending: THREE.AdditiveBlending,
    color: 0xfff0dd
  });
  const sunSprite = new THREE.Sprite(sunSpriteMat);
  sunSprite.position.copy(sunDisc.position);
  sunSprite.scale.set(120, 120, 1);
  envGroup.add(sunSprite);

  // 5. Earth-Shine Ambient Light (Soft blue bounced light from Earth)
  const earthShineLight = new THREE.DirectionalLight(0x2a528a, 0.7);
  earthShineLight.position.set(0, -1, 0); // shining upward onto bottom of satellite
  envGroup.add(earthShineLight);

  // Deep Space Ambient Light
  const spaceAmbient = new THREE.AmbientLight(0x181c24, 0.35);
  envGroup.add(spaceAmbient);

  function update(delta) {
    // Slow planetary rotation
    earthMesh.rotation.y += delta * 0.008;
    // Cloud layers rotate slightly faster
    cloudMesh.rotation.y += delta * 0.012;
  }

  return {
    group: envGroup,
    update
  };
}
