// The contract between the preview modal and whatever draws the asset (PixiJS runtime or 2D turntable).
export type Background = 'studio' | 'grid' | 'scorch';
export type Variant = 'desktop' | 'mobile';

/** Colours shared by both engines so a background looks the same for effects and props. */
export const BACKGROUNDS: Record<Background, { fill: number; css: string; line: number; mark: number }> = {
  studio: { fill: 0x0d1117, css: '#0d1117', line: 0x21262d, mark: 0x30363d },
  grid: { fill: 0x10141b, css: '#10141b', line: 0x2a313b, mark: 0x3d4652 },
  scorch: { fill: 0x2b231a, css: '#2b231a', line: 0x3a2f23, mark: 0x4a3c2c },
};

export interface Loaded {
  frames: number;
  /** Per-frame HUD strings, built once at load so a playing frame only swaps references and allocates nothing. */
  frameLabels: readonly string[];
  timeLabels: readonly string[];
  dimLabels: readonly string[];
  runtime: string;
  source: string;
  vramBytes: number;
  sheets: string;
}

export interface Engine {
  load(variant: Variant): Promise<Loaded>;
  setPlaying(on: boolean): void;
  setSpeed(speed: number): void;
  seek(frame: number): void;
  setBackground(bg: Background): void;
  /** Actor Dummy at the caster and target stations (effects only). */
  setDummy?(on: boolean): Promise<void>;
  /** GPU textures the renderer currently holds, for the HUD (effects only). */
  gpuTextures?(): number;
  /** Start drawing (modal visible). */
  start(): void;
  /** Stop the frame loop (modal hidden); the loaded asset stays ready. */
  stop(): void;
  /** Drop the loaded asset (GPU textures for effects). */
  release(): void;
  /** Called with the frame index whenever it changes. */
  onFrame: (frame: number) => void;
}

export const pad3 = (n: number) => (n < 10 ? '00' : n < 100 ? '0' : '') + n;
