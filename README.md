# CIPHER SPACE — Interactive Satellite Engineering & Spacewalk Game

An interactive 3D WebGL space exploration and engineering puzzle game built with **Three.js** and **Vite**. You are an astronaut in orbit around Earth, tasked with replacing, customizing, and balancing modular satellite subsystems (**SAT-ALPHA 01**) to achieve mission equilibrium across progressive orbital scenarios.

---

## 🎮 Flight & Engineering Controls

| Control | Action |
| :--- | :--- |
| **W** / **S** | Fire Thrusters Forward / Backward |
| **A** / **D** | Strafe Left / Strafe Right |
| **SPACE** / **SHIFT** | Ascend / Descend |
| **MOUSE** | 360° Free Look (Pitch & Yaw) |
| **CLICK** | Lock Cursor & Engage Zero-G Flight |
| **E** or **TAB** | **Toggle Orbital Customization Workbench** |
| **ESC** | Release Cursor / Pause Flight |
| **H** | Toggle Helmet Visor HUD Display |
| **M** | Toggle Sound FX & Cosmic Ambience |

---

## 🛰️ Modular Satellite Subsystems & Fixed Rates

### 1. Power Generation (⚡)
- **Dual Solar Wings**: `+550 W`, `120 kg`, low heat. Lightweight dual-panel articulated solar array.
- **Hex High-Output Array**: `+1050 W`, `260 kg`, medium heat. Extended 6-panel high-efficiency silicon wings.
- **Nuclear RTG Core**: `+780 W`, `380 kg`, high heat. Radioisotope thermoelectric generator delivering constant power regardless of solar angle.

### 2. Communications (📡)
- **Parabolic High-Gain Dish**: `700 Mbps`, `-180 W`, `140 kg`. Steerable parabolic dish reflector.
- **Hex Phased Array**: `1600 Mbps`, `-380 W`, `210 kg`. Electronically steered planar array panel with glowing circuit elements.
- **Optical Laser Transceiver**: `2600 Mbps`, `-620 W`, `290 kg`. Dual coherent laser communication turrets.

### 3. Chassis & Thermal Shielding (🛡️)
- **Mylar Gold Bus (Light)**: Max load `800 kg`, `450 W` base heat shedding, `180 kg` bus mass.
- **Titanium Armored Exo-Core**: Max load `1600 kg`, `1150 W` base heat shedding, `450 kg` bus mass. Equipped with active radiator louvers.
- **Carbon-Composite Hex Bus**: Max load `1200 kg`, `780 W` base heat shedding, `280 kg` bus mass. High strength-to-weight balance.

### 4. Science Payload (🔬)
- **Multispectral Earth Camera**: `450 Mbps` data generation, `-120 W`, `95 kg`. High-aperture optical barrel scanner.
- **Synthetic Aperture Radar (SAR)**: `1350 Mbps` data generation, `-360 W`, `240 kg`. Foldable radar boom antenna.
- **Deep-Space Spectrometer**: `850 Mbps` data generation, `-220 W`, `160 kg`. Magnetometer boom and cosmic radiation sensor suite.

---

## 🎛️ Real-Time Physical 3D Tuning Sliders

1. **Solar Array Tilt (`0°` to `90°`)**:
   - Physically rotates the solar panel wings in 3D relative to the Sun, varying solar generation from 45% to 100%.
2. **Comms Transmission Boost (`20 W` to `200 W`)**:
   - Increases data transmission bandwidth by up to `+75%` at the cost of higher electrical consumption and heat.
3. **Radiator Louvers Aperture (`0%` to `100%`)**:
   - Physically opens and angles the heat dissipation louvers on the satellite chassis in 3D, increasing thermal shedding capacity by up to `+450 W`.
4. **Sensor Duty Cycle (`25%` to `100%`)**:
   - Calibrates scientific data output to match available comms transmission bandwidth without data overflow bottlenecks.

---

## 🏆 Mission Scenarios & Win Conditions

1. **Mission 1: Earth Climate Monitor**
   - Targets: Net Power $\ge +150\text{ W}$, Data Rate $\ge 600\text{ Mbps}$, Mass $\le 800\text{ kg}$, Heat $\le 500\text{ W}$.
2. **Mission 2: Deep-Space Quantum Relay**
   - Targets: Net Power $\ge +250\text{ W}$, Data Rate $\ge 1500\text{ Mbps}$, Mass $\le 1200\text{ kg}$, Heat $\le 800\text{ W}$.
3. **Mission 3: Solar Storm Hardening**
   - Targets: Net Power $\ge +350\text{ W}$, Data Rate $\ge 1000\text{ Mbps}$, Mass $\le 1600\text{ kg}$, Heat $\le 1100\text{ W}$.

When all 4 gauges enter the **Green Equilibrium Zone**, the **"VERIFY & LAUNCH MISSION"** button unlocks. Clicking it triggers full telemetry synchronization, celebratory fanfare, and advances you to the next mission!

---

## 🛠️ Development & Running

```bash
# Start local development server
npm run dev

# Build for production
npm run build
```
Live server running at **[http://localhost:5173/](http://localhost:5173/)**.
