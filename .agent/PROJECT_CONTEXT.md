# ddxx7 - Project Context

## Project Overview

**DDXX7** is a high-fidelity FM synthesis simulator and SysEx editor.
- **Goal**: Faithful recreation of 6-operator FM (DX7 compatible)
- **Live URL**: https://acidsound.github.io/ddxx7/
- **Repository**: https://github.com/acidsound/ddxx7

## Architecture

### Audio Engine
- **Core**: Web Audio API + AudioWorklet
- **Implementation**: 6-Operator FM Engine with 32 algorithms
- **Features**:
  - Detailed Envelope Generators (Rate/Level)
  - Operator Feedback
  - Real-time modulation

### MIDI Integration
- **API**: WebMIDI API
- **Features**:
  - Bi-directional SysEx sync (Editor <-> Hardware)
  - Note On/Off, Velocity, Pitch Bend, Mod Wheel
  - Auto-Sync parameter changes

### Tech Stack
- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Vanilla CSS (Retro look)

## Key Features

1. **Algorithm Matrix**: Visual representation of FM algorithms
2. **SysEx Editor**: Real-time parameter control for hardware DX7
3. **Library**: ROM banks (1A-4B) and .syx file import/export
4. **Retro UI**: High-contrast, solid-state aesthetic

## File Structure

```
ddxx7/
├── src/
│   ├── components/     # React UI Components
│   ├── services/       # MIDI & Audio logic
│   ├── public/
│   │   └── worklets/   # FM Synthesis AudioWorklet
│   └── types.ts
├── .agent/             # AI Agent configs
└── README.md
```

## Operational Guidelines

### 1. AudioWorklet
- FM synthesis logic is performance-critical
- Careful with memory allocation in `process()` method

### 2. SysEx Handling
- SysEx messages format: `F0 43 00 00 ... F7`
- Requires valid checksum calculation

### 3. Shared Tools
- **Screenshots**: Run `npx acid-screenshot` in project root
- **Quality**: Run `npx acid-quality`
