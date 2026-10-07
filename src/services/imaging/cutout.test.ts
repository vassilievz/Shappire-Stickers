import { describe, expect, it } from 'vitest';
import { removeColorFromImageData } from './cutout';

describe('cutout / removeColorFromImageData', () => {
  it('removes matching color globally when contiguous is false', () => {
    // 2x2 image: [white, red], [white, white]
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // 0,0: White
      255, 0, 0, 255,     // 1,0: Red
      255, 255, 255, 255, // 0,1: White
      255, 255, 255, 255, // 1,1: White
    ]);
    const imageData = new ImageData(data, 2, 2);

    removeColorFromImageData(imageData, {
      targetR: 255,
      targetG: 255,
      targetB: 255,
      tolerance: 0.1,
      contiguous: false,
    });

    // White pixels should have alpha 0
    expect(imageData.data[3]).toBe(0); // 0,0
    expect(imageData.data[7]).toBe(255); // 1,0 (Red stays opaque)
    expect(imageData.data[11]).toBe(0); // 0,1
    expect(imageData.data[15]).toBe(0); // 1,1
  });

  it('removes only contiguous pixels connected to start point', () => {
    // 3x1 image: [white, red, white]
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // 0,0: White
      255, 0, 0, 255,     // 1,0: Red barrier
      255, 255, 255, 255, // 2,0: White
    ]);
    const imageData = new ImageData(data, 3, 1);

    // Flood fill starting at (0, 0)
    removeColorFromImageData(imageData, {
      targetR: 255,
      targetG: 255,
      targetB: 255,
      tolerance: 0.1,
      contiguous: true,
      startX: 0,
      startY: 0,
    });

    expect(imageData.data[3]).toBe(0); // 0,0 cleared
    expect(imageData.data[7]).toBe(255); // 1,0 kept
    expect(imageData.data[11]).toBe(255); // 2,0 kept because barrier blocked it
  });
});
