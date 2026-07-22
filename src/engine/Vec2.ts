export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vecKey(v: Vec2): string {
  return `${v.x},${v.y}`;
}

export function vecEquals(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
