declare module 'canvas-confetti' {
  import { ConfettiTypes } from 'canvas-confetti';
  
  export default function confetti(options?: ConfettiTypes & {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    numberOfRnd?: number;
    origin?: { x?: number; y?: number };
    angle?: number;
    shapes?: string[];
    property?: 'color' | 'position' | 'angle';
    localVelocity?: boolean;
    gravity?: number;
    drift?: number;
    scalar?: number | [number, number];
  }): void;
}