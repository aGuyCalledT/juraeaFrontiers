// Axial hex coordinates, pointy-top layout (like a Catan board).
// Directions match HexDirection.java.
export const DIRS: [number, number][] = [
  [-1, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
];

export const HEX_SIZE = 60; // corner radius in SVG units
export const SQRT3 = Math.sqrt(3);

export function hexToPixel(q: number, r: number, size = HEX_SIZE): { x: number; y: number } {
  return { x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r };
}

export function hexDistance(aq: number, ar: number, bq: number, br: number): number {
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

export function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts;
}

export function key(q: number, r: number): string {
  return q + ',' + r;
}
