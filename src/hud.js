/**
 * HUD & Telemetry Interface manager
 */

export class VisorHUD {
  constructor() {
    this.hudContainer = document.getElementById('visor-hud');
    this.distanceEl = document.getElementById('hud-range');
    this.speedEl = document.getElementById('hud-speed');
    this.coordsEl = document.getElementById('hud-coords');
    this.audioStatusEl = document.getElementById('hud-audio-status');
    this.lockPrompt = document.getElementById('lock-prompt');
    this.reticle = document.getElementById('reticle');

    this.isVisible = true;
  }

  update(controller, satellitePos) {
    if (!this.isVisible) return;

    const playerPos = controller.getPosition();
    const distance = playerPos.distanceTo(satellitePos);
    const speed = controller.getSpeed();

    if (this.distanceEl) {
      this.distanceEl.textContent = `${distance.toFixed(2)} m`;
    }

    if (this.speedEl) {
      this.speedEl.textContent = `${speed.toFixed(2)} m/s`;
    }

    if (this.coordsEl) {
      this.coordsEl.textContent = `X: ${playerPos.x.toFixed(1)}  Y: ${playerPos.y.toFixed(1)}  Z: ${playerPos.z.toFixed(1)}`;
    }
  }

  setLockedState(isLocked) {
    if (this.lockPrompt) {
      this.lockPrompt.style.display = isLocked ? 'none' : 'flex';
    }
    if (this.reticle) {
      this.reticle.style.opacity = isLocked ? '1' : '0.3';
    }
  }

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    if (this.hudContainer) {
      this.hudContainer.style.opacity = this.isVisible ? '1' : '0';
      this.hudContainer.style.pointerEvents = this.isVisible ? 'auto' : 'none';
    }
    return this.isVisible;
  }

  updateAudioStatus(isMuted) {
    if (this.audioStatusEl) {
      this.audioStatusEl.textContent = isMuted ? 'MUTED' : 'ONLINE';
      this.audioStatusEl.style.color = isMuted ? '#ff5555' : '#00e5ff';
    }
  }
}
