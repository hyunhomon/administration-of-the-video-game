/**
 * Zero-dependency Web Audio API 16-bit RPG sound synthesizer.
 * Safe in headless/automated browsers where AudioContext may be suspended or unavailable.
 */
export class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playStep(): void {
    this.tone(180, 0.04, 'triangle', 0.04);
  }

  public playSpeech(): void {
    this.tone(440, 0.06, 'square', 0.05);
    setTimeout(() => this.tone(587, 0.07, 'square', 0.05), 60);
  }

  public playRouteChange(): void {
    this.tone(523.25, 0.09, 'square', 0.07);
    setTimeout(() => this.tone(659.25, 0.09, 'square', 0.07), 90);
    setTimeout(() => this.tone(783.99, 0.16, 'square', 0.08), 180);
  }

  public playLevelUp(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.tone(freq, 0.11, 'square', 0.07), idx * 85);
    });
  }

  public playAlert(): void {
    this.tone(220, 0.12, 'sawtooth', 0.07);
    setTimeout(() => this.tone(165, 0.16, 'sawtooth', 0.07), 110);
  }

  private tone(freq: number, durationSec: number, type: OscillatorType, gainVal: number): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch {
      // Ignore audio errors in headless environments
    }
  }
}
