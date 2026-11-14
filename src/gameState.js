/**
 * Game State, Parts Catalog, Economy Calculations, and Mission Scenarios.
 */

export const PARTS_CATALOG = {
  power: {
    dual_wing: {
      id: 'dual_wing',
      name: 'Dual Solar Wings',
      badge: 'SOLAR',
      baseGen: 550,
      mass: 120,
      heat: 50,
      desc: 'Compact 2-panel articulated solar arrays with gold busbars.'
    },
    hex_array: {
      id: 'hex_array',
      name: 'Hex High-Output Array',
      badge: 'HIGH EFF',
      baseGen: 1050,
      mass: 260,
      heat: 130,
      desc: 'Extended 6-panel high-efficiency silicon photovoltaic wings.'
    },
    nuclear_rtg: {
      id: 'nuclear_rtg',
      name: 'Nuclear RTG Core',
      badge: 'ATOMIC',
      baseGen: 780,
      mass: 380,
      heat: 290,
      desc: 'Radioisotope thermoelectric generator. Constant power regardless of Sun angle.'
    }
  },

  comms: {
    dish: {
      id: 'dish',
      name: 'Parabolic Dish',
      badge: 'RF DISH',
      baseRate: 700,
      baseDraw: 180,
      mass: 140,
      desc: 'Steerable high-gain parabolic reflector on a dual-axis gimbal arm.'
    },
    phased_array: {
      id: 'phased_array',
      name: 'Hex Phased Array',
      badge: 'PHASED',
      baseRate: 1600,
      baseDraw: 380,
      mass: 210,
      desc: 'Electronically steered planar antenna with high packet bandwidth.'
    },
    laser_comm: {
      id: 'laser_comm',
      name: 'Optical Laser Transceiver',
      badge: 'PHOTON',
      baseRate: 2600,
      baseDraw: 620,
      mass: 290,
      desc: 'Twin coherent optical laser turrets for ultra-high-throughput data beaming.'
    }
  },

  chassis: {
    gold_mylar: {
      id: 'gold_mylar',
      name: 'Mylar Gold Bus (Light)',
      badge: 'LIGHTWEIGHT',
      maxLoad: 800,
      heatShed: 450,
      mass: 180,
      desc: 'Insulated thermal blanket bus with titanium edge struts. Ideal for lightweight missions.'
    },
    titanium_exo: {
      id: 'titanium_exo',
      name: 'Titanium Armored Exo-Core',
      badge: 'HEAVY ARMOR',
      maxLoad: 1600,
      heatShed: 1150,
      mass: 450,
      desc: 'Reinforced heavy-duty framework equipped with active thermal radiator louvers.'
    },
    carbon_hex: {
      id: 'carbon_hex',
      name: 'Carbon-Composite Hex Bus',
      badge: 'COMPOSITE',
      maxLoad: 1200,
      heatShed: 780,
      mass: 280,
      desc: 'High-tensile carbon weave chassis offering high strength-to-weight balance.'
    }
  },

  science: {
    earth_cam: {
      id: 'earth_cam',
      name: 'Multispectral Earth Camera',
      badge: 'OPTICAL',
      genRate: 450,
      baseDraw: 120,
      mass: 95,
      desc: 'Cryo-cooled optical barrel camera for multispectral planetary observation.'
    },
    sar_radar: {
      id: 'sar_radar',
      name: 'Synthetic Aperture Radar (SAR)',
      badge: 'RADAR',
      genRate: 1350,
      baseDraw: 360,
      mass: 240,
      desc: 'Deployable radar boom for topographic terrain mapping through cloud cover.'
    },
    spectrometer: {
      id: 'spectrometer',
      name: 'Deep-Space Spectrometer',
      badge: 'SENSORS',
      genRate: 850,
      baseDraw: 220,
      mass: 160,
      desc: 'Long magnetometer mast and radiation sensor package for cosmic ray detection.'
    }
  }
};

export const MISSION_SCENARIOS = [
  {
    id: 0,
    title: 'Mission 1: Earth Climate Monitor',
    code: 'ORBIT-CLIM-01',
    description: 'Deploy a high-resolution orbital climate monitoring platform. Keep payload mass light while maintaining net positive power.',
    targets: {
      minNetPower: 150,   // Watts
      minDataRate: 600,    // Mbps
      maxMass: 800,        // kg
      maxHeat: 500         // Watts
    }
  },
  {
    id: 1,
    title: 'Mission 2: Deep-Space Quantum Relay',
    code: 'DEEP-RELAY-02',
    description: 'Construct a high-bandwidth orbital data relay station. Requires high data throughput and robust thermal heat dissipation.',
    targets: {
      minNetPower: 250,   // Watts
      minDataRate: 1500,   // Mbps
      maxMass: 1200,       // kg
      maxHeat: 800         // Watts
    }
  },
  {
    id: 2,
    title: 'Mission 3: Solar Storm Hardening',
    code: 'HELIOS-HARD-03',
    description: 'Hardened satellite surviving coronal mass ejections. Requires heavy structural armor, large cooling louvers, and maximum power reserves.',
    targets: {
      minNetPower: 350,   // Watts
      minDataRate: 1000,   // Mbps
      maxMass: 1600,       // kg
      maxHeat: 1100        // Watts
    }
  }
];

class GameStateManager {
  constructor() {
    this.currentScenarioIndex = 0;

    // Installed components
    this.loadout = {
      power: 'dual_wing',
      comms: 'dish',
      chassis: 'gold_mylar',
      science: 'earth_cam'
    };

    // Fine-tuning adjustments
    this.tuning = {
      solarTilt: 45,       // degrees (0 - 90)
      commsPower: 60,      // boost (20 - 200 Watts)
      radiatorLouvers: 35, // percent (0 - 100 %)
      sensorRate: 80       // duty cycle (25 - 100 %)
    };

    this.onStateChange = null;
  }

  getCurrentScenario() {
    return MISSION_SCENARIOS[this.currentScenarioIndex];
  }

  setScenario(index) {
    if (index >= 0 && index < MISSION_SCENARIOS.length) {
      this.currentScenarioIndex = index;
      if (this.onStateChange) this.onStateChange();
    }
  }

  nextScenario() {
    if (this.currentScenarioIndex < MISSION_SCENARIOS.length - 1) {
      this.setScenario(this.currentScenarioIndex + 1);
      return true;
    }
    return false;
  }

  setComponent(category, partId) {
    if (this.loadout[category] && PARTS_CATALOG[category][partId]) {
      this.loadout[category] = partId;
      if (this.onStateChange) this.onStateChange();
    }
  }

  cycleComponent(category) {
    if (!this.loadout[category] || !PARTS_CATALOG[category]) return null;
    const parts = Object.keys(PARTS_CATALOG[category]);
    const currentIdx = parts.indexOf(this.loadout[category]);
    const nextIdx = (currentIdx + 1) % parts.length;
    const nextPartId = parts[nextIdx];
    this.setComponent(category, nextPartId);
    return PARTS_CATALOG[category][nextPartId];
  }

  adjustTuningDelta(parameter, delta) {
    if (!(parameter in this.tuning)) return;
    if (parameter === 'solarTilt') {
      this.tuning.solarTilt = Math.max(0, Math.min(90, Math.round(this.tuning.solarTilt + delta)));
    } else if (parameter === 'commsPower') {
      this.tuning.commsPower = Math.max(20, Math.min(200, Math.round(this.tuning.commsPower + delta)));
    } else if (parameter === 'radiatorLouvers') {
      this.tuning.radiatorLouvers = Math.max(0, Math.min(100, Math.round(this.tuning.radiatorLouvers + delta)));
    } else if (parameter === 'sensorRate') {
      this.tuning.sensorRate = Math.max(25, Math.min(100, Math.round(this.tuning.sensorRate + delta)));
    }
    if (this.onStateChange) this.onStateChange();
    return this.tuning[parameter];
  }

  getComponentData(category) {
    if (!this.loadout[category] || !PARTS_CATALOG[category]) return null;
    return PARTS_CATALOG[category][this.loadout[category]];
  }

  setTuning(parameter, value) {
    if (parameter in this.tuning) {
      this.tuning[parameter] = Number(value);
      if (this.onStateChange) this.onStateChange();
    }
  }

  computeMetrics() {
    const powerPart = PARTS_CATALOG.power[this.loadout.power];
    const commsPart = PARTS_CATALOG.comms[this.loadout.comms];
    const chassisPart = PARTS_CATALOG.chassis[this.loadout.chassis];
    const sciencePart = PARTS_CATALOG.science[this.loadout.science];
    const scenario = this.getCurrentScenario();

    // 1. Power Generation calculation
    let powerGen = 0;
    if (this.loadout.power === 'nuclear_rtg') {
      // RTG is constant regardless of tilt
      powerGen = powerPart.baseGen;
    } else {
      // Solar array depends on tilt angle relative to Sun (0 deg = grazing, 90 deg = direct normal)
      const rad = (this.tuning.solarTilt * Math.PI) / 180;
      const efficiency = 0.45 + 0.55 * Math.sin(rad);
      powerGen = Math.round(powerPart.baseGen * efficiency);
    }

    // 2. Power Consumption calculation
    const commsDraw = commsPart.baseDraw + Math.round((this.tuning.commsPower / 200) * 160);
    const sensorDraw = Math.round(sciencePart.baseDraw * (this.tuning.sensorRate / 100));
    const avionicsBaseDraw = 70; // baseline satellite computer
    const totalPowerDraw = commsDraw + sensorDraw + avionicsBaseDraw;

    // Net Power
    const netPower = powerGen - totalPowerDraw;

    // 3. Comms Transmission Rate
    const commsBoostFactor = 1.0 + (this.tuning.commsPower / 200) * 0.75;
    const dataRate = Math.round(commsPart.baseRate * commsBoostFactor);

    // Science Data Output
    const sensorOutput = Math.round(sciencePart.genRate * (this.tuning.sensorRate / 100));

    // 4. Total Mass
    const totalMass = powerPart.mass + commsPart.mass + chassisPart.mass + sciencePart.mass;

    // 5. Thermal Heat
    // Components generate heat proportional to power dissipation
    const heatGenerated = Math.round((totalPowerDraw + powerPart.heat) * 0.78);
    // Radiator dissipates heat (boosted by open louvers)
    const louverBonus = Math.round((this.tuning.radiatorLouvers / 100) * 450);
    const heatDissipated = chassisPart.heatShed + louverBonus;
    const netHeat = heatGenerated; // compare against heatDissipated and target

    // 6. Win Conditions Verification
    const isNetPowerOk = netPower >= scenario.targets.minNetPower;
    const isDataRateOk = dataRate >= scenario.targets.minDataRate && dataRate >= sensorOutput;
    const isMassOk = totalMass <= scenario.targets.maxMass && totalMass <= chassisPart.maxLoad;
    const isHeatOk = netHeat <= scenario.targets.maxHeat && netHeat <= heatDissipated;

    const isVictory = isNetPowerOk && isDataRateOk && isMassOk && isHeatOk;

    return {
      powerGen,
      totalPowerDraw,
      netPower,
      dataRate,
      sensorOutput,
      totalMass,
      chassisMaxLoad: chassisPart.maxLoad,
      netHeat,
      heatDissipated,
      targets: scenario.targets,
      // Target checks
      isNetPowerOk,
      isDataRateOk,
      isMassOk,
      isHeatOk,
      isVictory
    };
  }
}

export const gameState = new GameStateManager();
