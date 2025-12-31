import { Patch } from '../types';
import { ALGORITHMS } from './algorithms';

export class DX7Engine {
  private context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private patchQueue: Patch | null = null;

  constructor(patch: Patch) {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.patchQueue = patch;
    this.init();
  }

  private async init() {
    try {
      if (!this.context.audioWorklet) {
        const msg = "AudioWorklet not supported. Check HTTPS/Secure Context.";
        alert(msg); throw new Error(msg);
      }

      // Use relative path with cache busting
      await this.context.audioWorklet.addModule(`dx7-processor.js?v=${Date.now()}`);

      this.node = new AudioWorkletNode(this.context, 'dx7-processor', {
        outputChannelCount: [2],
        numberOfInputs: 0,
        numberOfOutputs: 1
      });

      this.node.port.onmessage = (e) => {
        if (e.data.type === 'opLevels' && this.opLevelsHandler) {
          this.opLevelsHandler(e.data.data);
        }
      };

      this.node.connect(this.context.destination);

      // Initialize algorithms data in the worklet
      this.node.port.postMessage({ type: 'init', algorithms: ALGORITHMS });

      if (this.patchQueue) {
        this.node.port.postMessage({ type: 'patch', data: this.patchQueue });
        this.patchQueue = null;
      }
    } catch (e: any) {
      console.error("AudioWorklet Load Error", e);
      alert("Audio Init Error: " + (e.message || e));
    }
  }

  async unlock() { if (this.context.state === 'suspended') await this.context.resume(); }
  updatePatch(patch: Patch) { this.node?.port.postMessage({ type: 'patch', data: patch }); this.patchQueue = patch; }
  noteOn(note: number, velocity: number) { this.node?.port.postMessage({ type: 'noteOn', data: { note, velocity } }); }
  noteOff(note: number) { this.node?.port.postMessage({ type: 'noteOff', data: { note } }); }
  panic() { this.node?.port.postMessage({ type: 'panic' }); }

  private opLevelsHandler: ((levels: Float32Array) => void) | null = null;

  setPitchBend(val: number) { this.node?.port.postMessage({ type: 'pitchBend', data: val }); }
  setModWheel(val: number) { this.node?.port.postMessage({ type: 'modWheel', data: val }); }
  setAftertouch(val: number) { this.node?.port.postMessage({ type: 'aftertouch', data: val }); }
  setSustain(val: boolean) { this.node?.port.postMessage({ type: 'sustain', data: val }); }

  public onOpLevels(callback: (levels: Float32Array) => void) {
    this.opLevelsHandler = callback;
  }
}