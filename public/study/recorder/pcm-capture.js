/* global AudioWorkletProcessor, currentFrame, sampleRate, registerProcessor */
// Streams bounded mono PCM chunks on the audio rendering clock. No network I/O.
class RecordingPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.buffer = new Float32Array(2048);
    this.used = 0;
    this.count = 0;
    this.startFrame = 0;
    this.limit = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.type === 'start' && Number.isSafeInteger(data.startFrame) && Number.isSafeInteger(data.maxFrames)
        && data.startFrame >= currentFrame && data.maxFrames > 0 && data.maxFrames <= sampleRate * 180 && !this.active) {
        this.active = true; this.used = 0; this.count = 0;
        this.startFrame = data.startFrame; this.limit = data.maxFrames;
      } else if (data?.type === 'start') this.port.postMessage({ type: 'error', reason: 'invalid-start' });
      else if (data?.type === 'stop') this.finish('user');
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.buffer.slice(0, this.used);
    this.port.postMessage({ type: 'chunk', startFrame: this.startFrame + this.count - this.used, samples }, [samples.buffer]);
    this.used = 0;
  }
  finish(reason) {
    if (!this.active) return;
    this.active = false; this.flush();
    this.port.postMessage({ type: 'stopped', frames: this.count, startFrame: this.startFrame, sampleRate, reason });
  }
  process(inputs) {
    if (!this.active) return true;
    const channels = inputs[0];
    if (!channels?.length) { this.finish('input-missing'); return true; }
    for (let i = 0; i < channels[0].length; i++) {
      const frame = currentFrame + i;
      if (frame < this.startFrame) continue;
      if (frame !== this.startFrame + this.count) { this.finish('clock-gap'); break; }
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      this.buffer[this.used++] = sample; this.count++;
      if (this.used === this.buffer.length) this.flush();
      if (this.count === this.limit) { this.finish('limit'); break; }
    }
    return true;
  }
}
registerProcessor('recording-pcm', RecordingPcmProcessor);
