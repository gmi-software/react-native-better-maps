/** 64-bit FNV-1a over a string, as two 32-bit halves in hex. Used to pin fixture determinism. */
export function fnv1a64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + index), 0x01000193) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function hashJson(value: unknown): string {
  return fnv1a64(JSON.stringify(value));
}
