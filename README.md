<div align="center">
  
# DDXX7
**A high-fidelity FM synthesis simulator and SysEx editor.**

[**🚀 Play Live Demo**](https://acidsound.github.io/ddxx7/) | [**📖 User Manual**](./MANUAL.md)
  
  [![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
</div>

---

## 🎹 Overview

**DDXX7** is a powerful web-based FM synthesizer that brings the classic 6-operator frequency modulation synthesis into your browser. Designed with both sound design and hardware integration in mind, it serves as both a high-fidelity simulator and a comprehensive SysEx editor for classic FM synthesizers.

> "A high-fidelity FM synthesis simulator and SysEx editor featuring a 6-operator FM synthesis engine, WebMIDI integration, and retro-inspired UI."

## ✨ Key Features

- **6-Operator Engine**: Faithfully recreated FM synthesis engine with 32 classic algorithms.
- **Real-time Editor**: Precise control over Operator parameters including Frequency (Coarse/Fine/Detune), Envelopes (Rate/Level), Level Scaling, and Sensitivity.
- **Library Management**: Built-in access to classic ROM banks (ROM1A-ROM4B) and support for custom `.syx` imports.
- **Patch Export**: Export your sound designs as standard `.syx` files for use with hardware or other simulators.
- **WebMIDI Integration**: Connect your MIDI controllers for expressive performance with support for Note On/Off, Velocity, Pitch Bend, Modulation Wheel, and Aftertouch.
- **SysEx Support**: Bi-directional communication with hardware. Import, Export, and Sync your patches in real-time.
- **Retro-Inspired UI**: A high-fidelity, high-contrast interface designed for clarity and performance, featuring solid state visualization and tactile controls.
- **Low Latency**: Built with the latest Web Audio API and custom `AudioWorklet` for responsive, performance-ready synthesis.

## 🛠 Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vite.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & Vanilla CSS
- **Audio Engine**: Web Audio API (`AudioWorklet`)
- **Integration**: WebMIDI API

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/ddxx7.git
   cd ddxx7
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🎛 Usage

### Editing Patches
Switch to the **Editor** tab to modify operator parameters. The Algorithm Matrix provides a visual representation of how operators interact. Adjust envelopes, pitch settings, and global parameters to sculpt your sound.

### Library Management
Use the **Library** tab to browse through internal patches. You can load your own `.syx` files by clicking the import button in the header.

### MIDI & Hardware Sync
Open the **MIDI Configuration** panel to select your input/output devices. Enable **Auto-Sync** to transmit parameter changes to your hardware synthesizer via SysEx in real-time.

---

## 🇰🇷 한국어 요약 (Summary in Korean)

**DDXX7**은 브라우저에서 바로 사용 가능한 강력한 FM 합성 시뮬레이터이자 SysEx 에디터입니다. 클래식 6-오퍼레이터 FM 합성 엔진을 정밀하게 재현하였으며, 하드웨어 신디사이저와의 연동을 위한 강력한 MIDI 기능을 제공합니다.

### 주요 특징
- **6-오퍼레이터 엔진**: 32가지 클래식 알고리즘을 지원하는 고정밀 FM 엔진.
- **실시간 에디터**: 주파수, 엔벨로프, 레벨 등 모든 파라미터를 브라우저에서 즉시 수정 가능.
- **라이브러리 관리**: 기본 ROM 뱅크(1A-4B) 탑재 및 사용자 SysEx 파일 관리.
- **패치 익스포트**: 나만의 사운드를 `.syx` 파일로 내보내 하드웨어 장비와 호환 가능.
- **WebMIDI 연동**: MIDI 컨트롤러를 통한 연주 및 실시간 파라미터 제어.
- **SysEx 지원**: `.syx` 파일 임포트/익스포트 및 하드웨어 장치와의 실시간 데이터 동기화.
- **고대비 UI**: 시인성이 개선된 프리미엄 레트로 디자인 및 실시간 엔벨로프 시각화.

---

<div align="center">
  <p>FM 신디사이저 애호가들을 위해 ❤️로 제작되었습니다.</p>
</div>
