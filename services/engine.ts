import { GlobalFxState, Patch } from '../types';
import { ALGORITHMS } from './algorithms';

export class DX7Engine {
  private context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private patchQueue: Patch | null = null;
  private globalFxQueue: GlobalFxState | null = null;
  private disposed = false;
  private dryGain: GainNode | null = null;
  private reverbSendGain: GainNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;

  constructor(patch: Patch, globalFx?: GlobalFxState) {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.patchQueue = patch;
    this.globalFxQueue = globalFx ?? null;
    this.init();
  }

  private createImpulseResponse(duration = 1.8, decay = 2.4) {
    const sampleRate = this.context.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const noise = Math.random() * 2 - 1;
        const shapedDecay = Math.pow(1 - t, decay);
        data[i] = noise * shapedDecay;
      }
    }

    return impulse;
  }

  private updateFxFromPatch(patch: Patch) {
    if (!this.dryGain || !this.reverbSendGain || !this.reverbWetGain) return;

    const send = Math.max(0, Math.min(99, Number(patch.reverbDepth ?? 0))) / 99;
    const wet = send * 0.55;
    const dry = 1 - wet * 0.35;
    const now = this.context.currentTime;
    const rampTime = now + 0.015;

    this.dryGain.gain.cancelScheduledValues(now);
    this.reverbSendGain.gain.cancelScheduledValues(now);
    this.reverbWetGain.gain.cancelScheduledValues(now);

    this.dryGain.gain.linearRampToValueAtTime(dry, rampTime);
    this.reverbSendGain.gain.linearRampToValueAtTime(send * 0.45, rampTime);
    this.reverbWetGain.gain.linearRampToValueAtTime(wet, rampTime);
  }

  private async init() {
    try {
      if (this.disposed) return;
      if (!this.context.audioWorklet) {
        const msg = "AudioWorklet not supported. Check HTTPS/Secure Context.";
        alert(msg); throw new Error(msg);
      }

      const workletUrl = new URL(`dx7-processor.js?v=${Date.now()}`, document.baseURI).toString();
      await this.context.audioWorklet.addModule(workletUrl);
      if (this.disposed) return;

      this.node = new AudioWorkletNode(this.context, 'dx7-processor', {
        outputChannelCount: [2],
        numberOfInputs: 0,
        numberOfOutputs: 1
      });

      this.dryGain = this.context.createGain();
      this.reverbSendGain = this.context.createGain();
      this.reverbWetGain = this.context.createGain();
      this.convolver = this.context.createConvolver();
      this.convolver.buffer = this.createImpulseResponse();

      this.node.port.onmessage = (e) => {
        if (e.data.type === 'opLevels' && this.opLevelsHandler) {
          this.opLevelsHandler(e.data.data, e.data.envStates);
        }
      };

      this.node.connect(this.dryGain);
      this.node.connect(this.reverbSendGain);
      this.reverbSendGain.connect(this.convolver);
      this.convolver.connect(this.reverbWetGain);
      this.dryGain.connect(this.context.destination);
      this.reverbWetGain.connect(this.context.destination);

      // Initialize algorithms data in the worklet
      this.node.port.postMessage({ type: 'init', algorithms: ALGORITHMS });

      if (this.patchQueue) {
        this.updateFxFromPatch(this.patchQueue);
        this.node.port.postMessage({ type: 'patch', data: this.patchQueue });
        this.patchQueue = null;
      }

      if (this.globalFxQueue) {
        this.node.port.postMessage({ type: 'globalFx', data: this.globalFxQueue });
        this.globalFxQueue = null;
      }
    } catch (e: any) {
      console.error("AudioWorklet Load Error", e);
      alert("Audio Init Error: " + (e.message || e));
    }
  }

  async unlock() {
    if (this.disposed) return;
    if (this.context.state === 'suspended') await this.context.resume();
  }
  updatePatch(patch: Patch) {
    if (this.disposed) return;
    this.updateFxFromPatch(patch);
    this.node?.port.postMessage({ type: 'patch', data: patch });
    this.patchQueue = patch;
  }
  updateGlobalFx(globalFx: GlobalFxState) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'globalFx', data: globalFx });
    this.globalFxQueue = globalFx;
  }
  noteOn(note: number, velocity: number) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'noteOn', data: { note, velocity } });
  }
  noteOff(note: number) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'noteOff', data: { note } });
  }
  panic() {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'panic' });
  }

  private opLevelsHandler: ((levels: Float32Array, envStates?: Int8Array) => void) | null = null;

  setPitchBend(val: number) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'pitchBend', data: val });
  }
  setModWheel(val: number) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'modWheel', data: val });
  }
  setAftertouch(val: number) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'aftertouch', data: val });
  }
  setSustain(val: boolean) {
    if (this.disposed) return;
    this.node?.port.postMessage({ type: 'sustain', data: val });
  }

  public onOpLevels(callback: (levels: Float32Array, envStates?: Int8Array) => void) {
    this.opLevelsHandler = callback;
  }

  getContext() { return this.context; }
  getState() { return this.context.state; }

  async dispose() {
    this.disposed = true;
    this.patchQueue = null;
    this.globalFxQueue = null;
    this.opLevelsHandler = null;

    if (this.node) {
      this.node.port.onmessage = null;
      try { this.node.disconnect(); } catch {}
      this.node = null;
    }

    for (const audioNode of [this.dryGain, this.reverbSendGain, this.reverbWetGain, this.convolver]) {
      try { audioNode?.disconnect(); } catch {}
    }
    this.dryGain = null;
    this.reverbSendGain = null;
    this.reverbWetGain = null;
    this.convolver = null;

    if (this.context.state !== 'closed') {
      await this.context.close();
    }
  }
}
