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
      await this.context.audioWorklet.addModule('/dx7-processor.js');

      this.node = new AudioWorkletNode(this.context, 'dx7-processor', {
        outputChannelCount: [2],
        numberOfInputs: 0,
        numberOfOutputs: 1
      });

      this.node.connect(this.context.destination);

      // Initialize algorithms data in the worklet
      this.node.port.postMessage({ type: 'init', algorithms: ALGORITHMS });

      if (this.patchQueue) {
        this.node.port.postMessage({ type: 'patch', data: this.patchQueue });
        this.patchQueue = null;
      }
    } catch (e) {
      console.error("AudioWorklet Load Error", e);
    }
  }

  async unlock() { if (this.context.state === 'suspended') await this.context.resume(); }
  updatePatch(patch: Patch) { this.node?.port.postMessage({ type: 'patch', data: patch }); this.patchQueue = patch; }
  noteOn(note: number, velocity: number) { this.node?.port.postMessage({ type: 'noteOn', data: { note, velocity } }); }
  noteOff(note: number) { this.node?.port.postMessage({ type: 'noteOff', data: { note } }); }
  panic() { this.node?.port.postMessage({ type: 'panic' }); }

  setPitchBend(val: number) { this.node?.port.postMessage({ type: 'pitchBend', data: val }); }
  setModWheel(val: number) { this.node?.port.postMessage({ type: 'modWheel', data: val }); }
  setAftertouch(val: number) { this.node?.port.postMessage({ type: 'aftertouch', data: val }); }
  setSustain(val: boolean) { this.node?.port.postMessage({ type: 'sustain', data: val }); }
}