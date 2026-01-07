# DDXX7 User Manual

**DDXX7** is a high-fidelity 6-operator FM synthesis simulator and SysEx editor. This manual covers basic operations, UI interaction, and keyboard shortcuts.

---

## 🌐 Live Demo
You can access the synthesizer directly in your browser:
**[https://acidsound.github.io/ddxx7/](https://acidsound.github.io/ddxx7/)**

---

## 🕹 Basic UI Interaction

### Control Elements
DDXX7 features custom tactile controls designed for precision:

1.  **Knobs (Potentiometers)**: 
    - Click and drag **vertically** (up/down) to change values.
    - A popover will show the exact value during adjustment.
2.  **Faders & Sliders**:
    - Click and drag to adjust envelope levels, rates, and master velocity.
3.  **Toggle Switches**:
    - Click to toggle states (e.g., LFO Sync, Mono mode).

---

## 🎹 Keyboard Shortcuts

You can play the synthesizer using your computer keyboard.

### Playing Notes
| Row | Keys | Notes |
| :--- | :--- | :--- |
| **Lower** | `Z` `S` `X` `D` `C` `V` `G` `B` `H` `N` `J` `M` `,` `L` `.` `;` `/` | C, C#, D, D#, E, F, F#, G, G#, A, A#, B, C... |
| **Upper** | `Q` `2` `W` `3` `E` `R` `5` `T` `6` `Y` `7` `U` `I` `9` `O` `0` `P` | C, C#, D, D#, E, F, F#, G, G#, A, A#, B, C... |

### Global Controls
- `[` : Decrease Octave
- `]` : Increase Octave

---

## 🎛 View Modes

### Editor View
Manage the detailed parameters of all 6 operators.
- **Algorithm Matrix**: Visualizes the FM signal flow. Highlighting indicates active modulation or feedback loops.
- **Operator Panels**: Control frequency (Coarse/Fine/Detune), Envelopes, and Keyboard Scaling for each operator.
- **Pitch EG**: Adjust the global pitch envelope.

### Library View
Browse and select patches from built-in ROMs or your imported files.
- **ROM Selector**: Switch between classic ROM banks (ROM1A to ROM4B).
- **Patch Grid**: Click a patch name to load it instantly.

---

## 🔌 MIDI & Hardware Integration

1.  Click the **MIDI Icon** in the header to open settings.
2.  **Input**: Select your MIDI controller to play via hardware.
3.  **Transmit Target**: Select your hardware synthesizer to sync parameters.
4.  **Auto-Sync**: When enabled, any parameter change in the Editor is transmitted to your hardware via SysEx in real-time.

---

## 📥 Import / Export

- **Import (.syx)**: Click the **Upload Icon** in the header to load `.syx` files (32-voice bank or single voice dump).
- **Export (.syx)**: Click the **Download Icon** in the header to export the current patch as a standard Yamaha DX7 compatible SysEx file.

---

## 🇰🇷 사용자 매뉴얼 (Korean)

### 조작 방법
- **노브 (Knob)**: 마우스로 클릭 후 **상하**로 드래그하여 값을 조절합니다.
- **스위치 (Switch)**: 클릭하여 기능을 켜고 끕니다.

### 키보드 단축키
- `Z`~`/` (하단), `Q`~`P` (상단): 건반 연주
- `[` / `]` : 옥타브 낮춤 / 높임

### 주요 기능
- **Editor**: 6개 오퍼레이터의 상세 파라미터 및 알고리즘 편집.
- **Library**: 내장 ROM(1A~4B) 선택 및 외부 SysEx 파일 불러오기.
- **MIDI Sync**: 하드웨어 신디사이저와 연결하여 실시간 파라미터 동기화 지원.
- **Export**: 현재 편집 중인 사운드를 `.syx` 파일로 저장.

---

<div align="center">
  <p>© 2026 acidsound. All rights reserved.</p>
</div>
