import * as THREE from 'three';
import { spaceAudio } from './audio.js';

export class SpacewalkController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Movement state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false
    };

    // Velocity & Physics
    this.velocity = new THREE.Vector3();
    this.acceleration = 16.0; // Thruster acceleration m/s^2
    this.damping = 0.94; // Flight Assist RCS braking (zero-g dampener)
    this.maxSpeed = 8.0;

    // Mouse look state
    this.isLocked = false;
    this.pitch = 0;
    this.yaw = 0;
    this.lookSensitivity = 0.0022;

    // Callbacks
    this.onLockChange = null;
    this.onToggleHUD = null;
    this.onToggleWorkbench = null;
    this.isWorkbenchOpen = false;

    // Spawn camera position: 5m facing the satellite dish and solar panels
    this.camera.position.set(0, 0.5, 5.2);
    this.camera.lookAt(0, 0, 0);

    // Initial Euler angles
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    this.yaw = euler.y;
    this.pitch = euler.x;

    this._bindEvents();
  }

  engage() {
    spaceAudio.init();
    this.isLocked = true;
    if (this.onLockChange) {
      this.onLockChange(true);
    }

    try {
      const promise = this.domElement.requestPointerLock();
      if (promise && promise.catch) {
        promise.catch((err) => {
          console.warn('PointerLock not granted:', err);
        });
      }
    } catch (err) {
      console.warn('PointerLock request error:', err);
    }
  }

  disengage() {
    this.isLocked = false;
    if (this.onLockChange) {
      this.onLockChange(false);
    }
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  _bindEvents() {
    const lockPrompt = document.getElementById('lock-prompt');
    const modalBtn = document.querySelector('.modal-btn');

    // Click on modal button or lock prompt starts flight
    if (modalBtn) {
      modalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engage();
      });
    }

    if (lockPrompt) {
      lockPrompt.addEventListener('click', () => {
        this.engage();
      });
    }

    // Canvas click
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked) {
        this.engage();
      }
    });

    // Pointer lock state changes
    document.addEventListener('pointerlockchange', () => {
      const isNowLocked = document.pointerLockElement === this.domElement;
      this.isLocked = isNowLocked;
      if (this.onLockChange) {
        this.onLockChange(isNowLocked);
      }
    });

    document.addEventListener('pointerlockerror', (err) => {
      console.warn('PointerLock error event:', err);
      // Keep game interactive even if pointer lock API has restrictions
      this.isLocked = true;
      if (this.onLockChange) {
        this.onLockChange(true);
      }
    });

    // Mouse movement
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    document.addEventListener('mousemove', (e) => {
      let movementX = 0;
      let movementY = 0;

      if (this.isLocked) {
        movementX = e.movementX || 0;
        movementY = e.movementY || 0;
      } else if (isMouseDown) {
        // Fallback drag-to-look when pointer isn't locked
        movementX = e.clientX - prevMouseX;
        movementY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      } else {
        return;
      }

      this.yaw -= movementX * this.lookSensitivity;
      this.pitch -= movementY * this.lookSensitivity;

      // Clamp vertical pitch (-85 deg to +85 deg)
      const maxPitch = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

      // Apply to camera
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.x = this.pitch;
      euler.y = this.yaw;
      this.camera.quaternion.setFromEuler(euler);
    });

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.up = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.down = true;
          e.preventDefault();
          break;
        case 'KeyH':
          if (this.onToggleHUD) this.onToggleHUD();
          break;
        case 'KeyE':
        case 'Tab':
          e.preventDefault();
          if (this.onToggleWorkbench) this.onToggleWorkbench();
          break;
        case 'KeyM':
          spaceAudio.toggleMute();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.down = false;
          break;
      }
    });
  }

  update(delta) {
    // Determine thruster direction in camera local space
    const moveDirection = new THREE.Vector3();

    if (this.keys.forward) moveDirection.z -= 1;
    if (this.keys.backward) moveDirection.z += 1;
    if (this.keys.left) moveDirection.x -= 1;
    if (this.keys.right) moveDirection.x += 1;
    if (this.keys.up) moveDirection.y += 1;
    if (this.keys.down) moveDirection.y -= 1;

    const isMoving = !this.isWorkbenchOpen && (moveDirection.lengthSq() > 0);

    // Thruster audio burst triggers
    spaceAudio.setThrusterActive(isMoving && this.isLocked && !this.isWorkbenchOpen);

    if (isMoving) {
      moveDirection.normalize();
      // Transform local movement direction into world space based on camera orientation
      moveDirection.applyQuaternion(this.camera.quaternion);

      // Accelerate
      this.velocity.addScaledVector(moveDirection, this.acceleration * delta);
    }

    // Apply zero-G flight assist damping
    this.velocity.multiplyScalar(Math.pow(this.damping, delta * 60));

    // Clamp max velocity
    if (this.velocity.length() > this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }

    // Integrate position
    this.camera.position.addScaledVector(this.velocity, delta);

    // Collision avoidance: gentle buffer pushing away from satellite center core
    const distFromCenter = this.camera.position.length();
    const minSafeDist = 1.9;
    if (distFromCenter < minSafeDist && distFromCenter > 0.001) {
      const pushOut = this.camera.position.clone().normalize().multiplyScalar(minSafeDist);
      this.camera.position.lerp(pushOut, 0.2);
      this.velocity.multiplyScalar(0.5); // absorb impact
    }
  }

  getSpeed() {
    return this.velocity.length();
  }

  getPosition() {
    return this.camera.position;
  }
}
