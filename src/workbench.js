import { PARTS_CATALOG, MISSION_SCENARIOS, gameState } from './gameState.js';
import { spaceAudio } from './audio.js';

export class WorkbenchUI {
  constructor(onLoadoutChange, onModeToggle) {
    this.onLoadoutChange = onLoadoutChange;
    this.onModeToggle = onModeToggle;
    this.activeCategory = 'power';
    this.isOpen = false;

    this.container = document.getElementById('workbench-panel');
    this.victoryModal = document.getElementById('victory-modal');

    this._initDom();
    this._bindEvents();
    this.render();
  }

  _initDom() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="wb-header">
        <div class="wb-title-group">
          <div class="wb-badge">ORBITAL WORKBENCH</div>
          <div class="wb-subtitle">MODULAR SATELLITE CUSTOMIZATION</div>
        </div>
        <button id="wb-close-btn" class="wb-icon-btn" title="Resume Flight [Tab]">✕</button>
      </div>

      <!-- Scenario Selector -->
      <div class="wb-scenario-box">
        <div class="wb-scenario-header">
          <span class="wb-scenario-label">ACTIVE MISSION:</span>
          <select id="wb-scenario-select" class="wb-select">
            ${MISSION_SCENARIOS.map((s, idx) => `<option value="${idx}">${s.title}</option>`).join('')}
          </select>
        </div>
        <div id="wb-scenario-desc" class="wb-scenario-desc"></div>
      </div>

      <!-- Category Tabs -->
      <div class="wb-tabs">
        <button class="wb-tab active" data-cat="power">⚡ POWER</button>
        <button class="wb-tab" data-cat="comms">📡 COMMS</button>
        <button class="wb-tab" data-cat="chassis">🛡️ CHASSIS</button>
        <button class="wb-tab" data-cat="science">🔬 SCIENCE</button>
      </div>

      <!-- Part Cards Container -->
      <div id="wb-cards-container" class="wb-cards-grid"></div>

      <!-- Interactive Tuning Sliders -->
      <div class="wb-tuning-section">
        <div class="wb-section-title">PHYSICAL TUNING & CALIBRATION</div>

        <div class="wb-slider-row">
          <div class="wb-slider-label">
            <span>Solar Array Tilt</span>
            <span id="val-solarTilt" class="wb-slider-val">45°</span>
          </div>
          <input type="range" id="slider-solarTilt" min="0" max="90" value="45" class="wb-range">
        </div>

        <div class="wb-slider-row">
          <div class="wb-slider-label">
            <span>Comms Transmission Boost</span>
            <span id="val-commsPower" class="wb-slider-val">60 W</span>
          </div>
          <input type="range" id="slider-commsPower" min="20" max="200" value="60" class="wb-range">
        </div>

        <div class="wb-slider-row">
          <div class="wb-slider-label">
            <span>Radiator Louvers Aperture</span>
            <span id="val-radiatorLouvers" class="wb-slider-val">35%</span>
          </div>
          <input type="range" id="slider-radiatorLouvers" min="0" max="100" value="35" class="wb-range">
        </div>

        <div class="wb-slider-row">
          <div class="wb-slider-label">
            <span>Sensor Duty Cycle</span>
            <span id="val-sensorRate" class="wb-slider-val">80%</span>
          </div>
          <input type="range" id="slider-sensorRate" min="25" max="100" value="80" class="wb-range">
        </div>
      </div>

      <!-- Live Telemetry & Mission Requirements Gauges -->
      <div class="wb-telemetry-section">
        <div class="wb-section-title">MISSION EQUILIBRIUM TELEMETRY</div>

        <div class="wb-gauge-row">
          <div class="wb-gauge-info">
            <span>NET POWER</span>
            <span id="gauge-val-power" class="wb-gauge-stat">--</span>
          </div>
          <div class="wb-bar-bg"><div id="gauge-bar-power" class="wb-bar-fill"></div></div>
          <div id="gauge-target-power" class="wb-gauge-target">Target: ≥ 150 W</div>
        </div>

        <div class="wb-gauge-row">
          <div class="wb-gauge-info">
            <span>DATA RATE</span>
            <span id="gauge-val-data" class="wb-gauge-stat">--</span>
          </div>
          <div class="wb-bar-bg"><div id="gauge-bar-data" class="wb-bar-fill"></div></div>
          <div id="gauge-target-data" class="wb-gauge-target">Target: ≥ 600 Mbps</div>
        </div>

        <div class="wb-gauge-row">
          <div class="wb-gauge-info">
            <span>PAYLOAD MASS</span>
            <span id="gauge-val-mass" class="wb-gauge-stat">--</span>
          </div>
          <div class="wb-bar-bg"><div id="gauge-bar-mass" class="wb-bar-fill"></div></div>
          <div id="gauge-target-mass" class="wb-gauge-target">Target: ≤ 800 kg</div>
        </div>

        <div class="wb-gauge-row">
          <div class="wb-gauge-info">
            <span>THERMAL HEAT</span>
            <span id="gauge-val-heat" class="wb-gauge-stat">--</span>
          </div>
          <div class="wb-bar-bg"><div id="gauge-bar-heat" class="wb-bar-fill"></div></div>
          <div id="gauge-target-heat" class="wb-gauge-target">Target: ≤ 500 W</div>
        </div>
      </div>

      <!-- Launch / Victory Trigger Button -->
      <div class="wb-footer">
        <button id="wb-launch-btn" class="wb-launch-btn disabled">
          🔒 MISSION EQUILIBRIUM REQUIRED
        </button>
      </div>
    `;
  }

  _bindEvents() {
    // Close button
    const closeBtn = document.getElementById('wb-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.onModeToggle) this.onModeToggle();
      });
    }

    // Scenario Select
    const scenarioSelect = document.getElementById('wb-scenario-select');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', (e) => {
        gameState.setScenario(Number(e.target.value));
        spaceAudio.playClick();
        this.render();
      });
    }

    // Category Tabs
    const tabs = this.container.querySelectorAll('.wb-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCategory = tab.dataset.cat;
        spaceAudio.playClick();
        this.renderCards();
      });
    });

    // Tuning Sliders
    const sliders = ['solarTilt', 'commsPower', 'radiatorLouvers', 'sensorRate'];
    sliders.forEach(param => {
      const slider = document.getElementById(`slider-${param}`);
      const valLabel = document.getElementById(`val-${param}`);
      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          gameState.setTuning(param, val);

          // Update label text
          if (param === 'solarTilt') valLabel.textContent = `${val}°`;
          else if (param === 'commsPower') valLabel.textContent = `${val} W`;
          else if (param === 'radiatorLouvers') valLabel.textContent = `${val}%`;
          else if (param === 'sensorRate') valLabel.textContent = `${val}%`;

          // Notify 3D renderer of slider movement
          if (this.onLoadoutChange) {
            this.onLoadoutChange(gameState.loadout, gameState.tuning);
          }
          this.updateGauges();
        });
      }
    });

    // Launch Mission Button
    const launchBtn = document.getElementById('wb-launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        const metrics = gameState.computeMetrics();
        if (metrics.isVictory) {
          this.showVictoryModal();
        }
      });
    }

    // Listen to GameState changes
    gameState.onStateChange = () => {
      this.updateGauges();
      if (this.onLoadoutChange) {
        this.onLoadoutChange(gameState.loadout, gameState.tuning);
      }
    };
  }

  show() {
    this.isOpen = true;
    if (this.container) {
      this.container.classList.add('open');
    }
    this.render();
  }

  hide() {
    this.isOpen = false;
    if (this.container) {
      this.container.classList.remove('open');
    }
  }

  toggle() {
    if (this.isOpen) this.hide();
    else this.show();
    return this.isOpen;
  }

  render() {
    const scenario = gameState.getCurrentScenario();
    const scenarioDesc = document.getElementById('wb-scenario-desc');
    const scenarioSelect = document.getElementById('wb-scenario-select');

    if (scenarioDesc) scenarioDesc.textContent = scenario.description;
    if (scenarioSelect) scenarioSelect.value = gameState.currentScenarioIndex;

    this.renderCards();
    this.updateGauges();
  }

  renderCards() {
    const cardsContainer = document.getElementById('wb-cards-container');
    if (!cardsContainer) return;

    const categoryParts = PARTS_CATALOG[this.activeCategory];
    const currentPartId = gameState.loadout[this.activeCategory];

    cardsContainer.innerHTML = '';

    Object.values(categoryParts).forEach(part => {
      const isSelected = part.id === currentPartId;
      const card = document.createElement('div');
      card.className = `wb-card ${isSelected ? 'selected' : ''}`;

      // Build stat pill items depending on category
      let statPills = '';
      if (this.activeCategory === 'power') {
        statPills = `<span class="wb-pill power">+${part.baseGen} W</span><span class="wb-pill mass">${part.mass} kg</span>`;
      } else if (this.activeCategory === 'comms') {
        statPills = `<span class="wb-pill data">${part.baseRate} Mbps</span><span class="wb-pill draw">-${part.baseDraw} W</span>`;
      } else if (this.activeCategory === 'chassis') {
        statPills = `<span class="wb-pill load">Max ${part.maxLoad} kg</span><span class="wb-pill heat">${part.heatShed} W cool</span>`;
      } else if (this.activeCategory === 'science') {
        statPills = `<span class="wb-pill data">${part.genRate} Mbps</span><span class="wb-pill mass">${part.mass} kg</span>`;
      }

      card.innerHTML = `
        <div class="wb-card-header">
          <div class="wb-card-name">${part.name}</div>
          <div class="wb-card-badge">${part.badge}</div>
        </div>
        <div class="wb-card-stats">${statPills}</div>
        <div class="wb-card-desc">${part.desc}</div>
      `;

      card.addEventListener('click', () => {
        gameState.setComponent(this.activeCategory, part.id);
        this.renderCards();
        this.updateGauges();
      });

      cardsContainer.appendChild(card);
    });
  }

  updateGauges() {
    const metrics = gameState.computeMetrics();
    const targets = metrics.targets;

    // 1. Net Power
    const powerVal = document.getElementById('gauge-val-power');
    const powerBar = document.getElementById('gauge-bar-power');
    const powerTgt = document.getElementById('gauge-target-power');
    if (powerVal && powerBar) {
      powerVal.textContent = `${metrics.netPower > 0 ? '+' : ''}${metrics.netPower} W`;
      powerVal.className = metrics.isNetPowerOk ? 'wb-gauge-stat ok' : 'wb-gauge-stat warn';
      const pct = Math.min(100, Math.max(0, (metrics.netPower / (targets.minNetPower * 1.5)) * 100));
      powerBar.style.width = `${pct}%`;
      powerBar.className = `wb-bar-fill ${metrics.isNetPowerOk ? 'green' : 'red'}`;
      powerTgt.textContent = `Target: ≥ ${targets.minNetPower} W (Gen: ${metrics.powerGen}W, Draw: ${metrics.totalPowerDraw}W)`;
    }

    // 2. Data Rate
    const dataVal = document.getElementById('gauge-val-data');
    const dataBar = document.getElementById('gauge-bar-data');
    const dataTgt = document.getElementById('gauge-target-data');
    if (dataVal && dataBar) {
      dataVal.textContent = `${metrics.dataRate} Mbps`;
      dataVal.className = metrics.isDataRateOk ? 'wb-gauge-stat ok' : 'wb-gauge-stat warn';
      const pct = Math.min(100, Math.max(0, (metrics.dataRate / (targets.minDataRate * 1.4)) * 100));
      dataBar.style.width = `${pct}%`;
      dataBar.className = `wb-bar-fill ${metrics.isDataRateOk ? 'green' : 'red'}`;
      dataTgt.textContent = `Target: ≥ ${targets.minDataRate} Mbps (Sensor: ${metrics.sensorOutput} Mbps)`;
    }

    // 3. Payload Mass
    const massVal = document.getElementById('gauge-val-mass');
    const massBar = document.getElementById('gauge-bar-mass');
    const massTgt = document.getElementById('gauge-target-mass');
    if (massVal && massBar) {
      massVal.textContent = `${metrics.totalMass} kg`;
      massVal.className = metrics.isMassOk ? 'wb-gauge-stat ok' : 'wb-gauge-stat warn';
      const pct = Math.min(100, Math.max(0, (metrics.totalMass / targets.maxMass) * 100));
      massBar.style.width = `${pct}%`;
      massBar.className = `wb-bar-fill ${metrics.isMassOk ? 'green' : 'red'}`;
      massTgt.textContent = `Target: ≤ ${targets.maxMass} kg (Chassis Max: ${metrics.chassisMaxLoad} kg)`;
    }

    // 4. Thermal Heat
    const heatVal = document.getElementById('gauge-val-heat');
    const heatBar = document.getElementById('gauge-bar-heat');
    const heatTgt = document.getElementById('gauge-target-heat');
    if (heatVal && heatBar) {
      heatVal.textContent = `${metrics.netHeat} W`;
      heatVal.className = metrics.isHeatOk ? 'wb-gauge-stat ok' : 'wb-gauge-stat warn';
      const pct = Math.min(100, Math.max(0, (metrics.netHeat / targets.maxHeat) * 100));
      heatBar.style.width = `${pct}%`;
      heatBar.className = `wb-bar-fill ${metrics.isHeatOk ? 'green' : 'red'}`;
      heatTgt.textContent = `Target: ≤ ${targets.maxHeat} W (Dissipation: ${metrics.heatDissipated} W)`;
    }

    // Launch Button State
    const launchBtn = document.getElementById('wb-launch-btn');
    if (launchBtn) {
      if (metrics.isVictory) {
        launchBtn.className = 'wb-launch-btn ready';
        launchBtn.innerHTML = '🚀 VERIFY & LAUNCH SATELLITE MISSION';
      } else {
        launchBtn.className = 'wb-launch-btn disabled';
        launchBtn.innerHTML = '🔒 MISSION EQUILIBRIUM REQUIRED';
      }
    }
  }

  showVictoryModal() {
    spaceAudio.playMissionSuccess();
    const scenario = gameState.getCurrentScenario();
    const modal = document.getElementById('victory-modal');
    if (!modal) return;

    const hasNext = gameState.currentScenarioIndex < MISSION_SCENARIOS.length - 1;

    modal.innerHTML = `
      <div class="victory-box">
        <div class="victory-icon">🛰️</div>
        <div class="victory-title">MISSION ACCOMPLISHED!</div>
        <div class="victory-code">${scenario.code} // VERIFIED & SYNCHRONIZED</div>
        <div class="victory-desc">
          Telemetry link confirmed! All satellite subsystems are stabilized within operational equilibrium.
          Solar wings aligned, comms transceiver beaming orbital telemetry, and Earth interface synchronized.
        </div>
        <div class="victory-actions">
          ${hasNext ? '<button id="btn-next-mission" class="victory-btn primary">NEXT MISSION SCENARIO →</button>' : ''}
          <button id="btn-continue-fly" class="victory-btn secondary">INSPECT IN FREE FLIGHT [TAB]</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const nextBtn = document.getElementById('btn-next-mission');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        gameState.nextScenario();
        this.render();
      });
    }

    const flyBtn = document.getElementById('btn-continue-fly');
    if (flyBtn) {
      flyBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (this.onModeToggle) this.onModeToggle();
      });
    }
  }
}
