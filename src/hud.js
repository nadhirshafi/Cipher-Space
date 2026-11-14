/**
 * Astronaut Visor HUD & Real-Time Telemetry Interface
 */

export class VisorHUD {
  constructor() {
    this.hudContainer = document.getElementById('visor-hud');
    this.distanceEl = document.getElementById('hud-range');
    this.speedEl = document.getElementById('hud-speed');
    this.coordsEl = document.getElementById('hud-coords');
    this.audioStatusEl = document.getElementById('hud-audio-status');
    this.avionicsStatusEl = document.getElementById('hud-avionics-status');
    this.lockPrompt = document.getElementById('lock-prompt');
    this.reticle = document.getElementById('reticle');

    // EVA Context Prompt elements
    this.evaPrompt = document.getElementById('eva-prompt');
    this.evaBadge = document.getElementById('eva-prompt-badge');
    this.evaTitle = document.getElementById('eva-prompt-title');
    this.evaActionSwap = document.getElementById('eva-action-swap');
    this.evaActionSwapText = document.getElementById('eva-action-swap-text');
    this.evaActionDrag = document.getElementById('eva-action-drag');
    this.evaActionDragText = document.getElementById('eva-action-drag-text');

    // Mission Tracker elements
    this.trackerTitle = document.getElementById('tracker-mission-title');
    this.valNetPower = document.getElementById('val-net-power');
    this.valDataRate = document.getElementById('val-data-rate');
    this.valTotalMass = document.getElementById('val-total-mass');
    this.valHeatLoad = document.getElementById('val-heat-load');

    this.barPower = document.getElementById('bar-power');
    this.barData = document.getElementById('bar-data');
    this.barMass = document.getElementById('bar-mass');
    this.barHeat = document.getElementById('bar-heat');

    this.gaugePower = document.getElementById('gauge-power');
    this.gaugeData = document.getElementById('gauge-data');
    this.gaugeMass = document.getElementById('gauge-mass');
    this.gaugeHeat = document.getElementById('gauge-heat');

    this.equilibriumBanner = document.getElementById('equilibrium-banner');
    this.equilibriumText = document.getElementById('equilibrium-text');

    // Cinematic Launch Modal
    this.launchModal = document.getElementById('launch-modal');
    this.launchModalTitle = document.getElementById('launch-modal-title');
    this.launchModalDesc = document.getElementById('launch-modal-desc');
    this.launchSummary = document.getElementById('launch-metrics-summary');
    this.nextMissionBtn = document.getElementById('next-mission-btn');

    this.isVisible = true;
    this.onNextMission = null;

    if (this.nextMissionBtn) {
      this.nextMissionBtn.addEventListener('click', () => {
        this.hideLaunchModal();
        if (this.onNextMission) this.onNextMission();
      });
    }
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

  updateEvaPrompt(hoveredObject, gameState, isDragging) {
    if (!this.evaPrompt) return;

    if (!hoveredObject) {
      this.evaPrompt.style.display = 'none';
      if (this.reticle) {
        this.reticle.classList.remove('hover-active', 'drag-active');
      }
      return;
    }

    const data = hoveredObject.userData;
    this.evaPrompt.style.display = 'flex';

    if (this.reticle) {
      this.reticle.classList.add('hover-active');
      if (isDragging) {
        this.reticle.classList.add('drag-active');
      } else {
        this.reticle.classList.remove('drag-active');
      }
    }

    if (data.isAvionics) {
      const metrics = gameState.computeMetrics();
      this.evaBadge.textContent = 'AVIONICS BUS';
      this.evaBadge.className = 'eva-badge avionics';
      this.evaTitle.textContent = 'ORBITAL UPLINK & LAUNCH TERMINAL';

      if (metrics.isVictory) {
        this.evaActionSwap.style.display = 'flex';
        this.evaActionSwapText.textContent = 'VERIFY & LAUNCH MISSION';
        this.evaActionDrag.style.display = 'none';
      } else {
        this.evaActionSwap.style.display = 'none';
        this.evaActionDrag.style.display = 'flex';
        this.evaActionDragText.textContent = 'STANDBY: BALANCE SUBSYSTEMS FIRST';
      }
      return;
    }

    // Normal Subsystem Mount
    this.evaBadge.textContent = data.category.toUpperCase();
    this.evaBadge.className = `eva-badge ${data.category}`;
    this.evaTitle.textContent = data.label;

    // Component swap info
    const currentPart = gameState.getComponentData(data.category);
    this.evaActionSwap.style.display = 'flex';
    this.evaActionSwapText.textContent = `CYCLE MODULE: ${currentPart ? currentPart.name.toUpperCase() : ''}`;

    // Parameter tuning info
    if (data.tuneParam) {
      this.evaActionDrag.style.display = 'flex';
      const curVal = gameState.tuning[data.tuneParam];
      const unit = data.tuneUnit || '';
      if (isDragging) {
        this.evaActionDragText.textContent = `TUNING ${data.tuneLabel}: ${curVal}${unit}`;
      } else {
        this.evaActionDragText.textContent = `DRAG TO TUNE: ${data.tuneLabel} (${curVal}${unit})`;
      }
    } else {
      this.evaActionDrag.style.display = 'none';
    }
  }

  updateMissionTracker(gameState) {
    const scenario = gameState.getCurrentScenario();
    const metrics = gameState.computeMetrics();

    if (this.trackerTitle) {
      this.trackerTitle.textContent = scenario.title;
    }

    // 1. Net Power
    if (this.valNetPower) {
      const sign = metrics.netPower >= 0 ? '+' : '';
      this.valNetPower.textContent = `${sign}${metrics.netPower} W (min ${scenario.targets.minNetPower} W)`;
      this.gaugePower.className = `gauge-item ${metrics.isNetPowerOk ? 'nominal' : 'critical'}`;
      const fillPct = Math.min(100, Math.max(0, (metrics.netPower / (scenario.targets.minNetPower * 2.2)) * 100));
      if (this.barPower) this.barPower.style.width = `${fillPct}%`;
    }

    // 2. Data Rate
    if (this.valDataRate) {
      this.valDataRate.textContent = `${metrics.dataRate} Mbps (min ${scenario.targets.minDataRate} Mbps)`;
      this.gaugeData.className = `gauge-item ${metrics.isDataRateOk ? 'nominal' : 'critical'}`;
      const fillPct = Math.min(100, Math.max(0, (metrics.dataRate / (scenario.targets.minDataRate * 1.8)) * 100));
      if (this.barData) this.barData.style.width = `${fillPct}%`;
    }

    // 3. Mass
    if (this.valTotalMass) {
      this.valTotalMass.textContent = `${metrics.totalMass} kg (max ${scenario.targets.maxMass} kg)`;
      this.gaugeMass.className = `gauge-item ${metrics.isMassOk ? 'nominal' : 'critical'}`;
      const fillPct = Math.min(100, Math.max(0, (metrics.totalMass / (scenario.targets.maxMass * 1.3)) * 100));
      if (this.barMass) this.barMass.style.width = `${fillPct}%`;
    }

    // 4. Heat
    if (this.valHeatLoad) {
      this.valHeatLoad.textContent = `${metrics.netHeat} W (max ${scenario.targets.maxHeat} W)`;
      this.gaugeHeat.className = `gauge-item ${metrics.isHeatOk ? 'nominal' : 'critical'}`;
      const fillPct = Math.min(100, Math.max(0, (metrics.netHeat / (scenario.targets.maxHeat * 1.4)) * 100));
      if (this.barHeat) this.barHeat.style.width = `${fillPct}%`;
    }

    // Equilibrium Banner & Avionics status
    if (this.equilibriumBanner) {
      if (metrics.isVictory) {
        this.equilibriumBanner.className = 'equilibrium-status ready';
        this.equilibriumText.textContent = 'EQUILIBRIUM ACHIEVED — READY FOR LAUNCH';
        if (this.avionicsStatusEl) {
          this.avionicsStatusEl.textContent = 'ONLINE / READY';
          this.avionicsStatusEl.className = 'telemetry-value nominal';
        }
      } else {
        this.equilibriumBanner.className = 'equilibrium-status warning';
        this.equilibriumText.textContent = 'SUBSYSTEM BALANCING IN PROGRESS';
        if (this.avionicsStatusEl) {
          this.avionicsStatusEl.textContent = 'STANDBY';
          this.avionicsStatusEl.className = 'telemetry-value';
        }
      }
    }
  }

  showLaunchModal(scenario, metrics, nextCallback) {
    if (!this.launchModal) return;
    this.onNextMission = nextCallback;

    if (this.launchModalTitle) {
      this.launchModalTitle.textContent = `${scenario.title.toUpperCase()} DEPLOYED!`;
    }
    if (this.launchModalDesc) {
      this.launchModalDesc.textContent = `All telemetry parameters synchronized. Satellite SAT-ALPHA 01 successfully verified in orbital equilibrium.`;
    }
    if (this.launchSummary) {
      this.launchSummary.innerHTML = `
        <div class="summary-pill">⚡ NET POWER: +${metrics.netPower} W</div>
        <div class="summary-pill">📡 BANDWIDTH: ${metrics.dataRate} Mbps</div>
        <div class="summary-pill">⚖️ MASS: ${metrics.totalMass} kg</div>
        <div class="summary-pill">🔥 HEAT DISSIPATION: ${metrics.netHeat} W</div>
      `;
    }

    this.launchModal.style.display = 'flex';
  }

  hideLaunchModal() {
    if (this.launchModal) {
      this.launchModal.style.display = 'none';
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
