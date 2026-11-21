// Passport of Meridiana — an invented passport spread, drawn pixel by pixel.
// Node 22, stdlib only (node:fs, node:zlib). No network, no fonts, no images:
// every glyph comes from the 5x7 bitmap font below and every shape is drawn
// by the raster helpers in this file. Deterministic output.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

export const W = 1024;
export const H = 640;

type RGB = [number, number, number];
const buf = new Uint8Array(W * H * 3);

// ---- seeded PRNG (deterministic paper grain) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- palette ----
const INK: RGB = [31, 46, 66];
const NAVY: RGB = [31, 58, 95];
const TEAL: RGB = [38, 102, 98];
const BURG: RGB = [122, 46, 58];
const GOLD: RGB = [164, 124, 52];
const PAPER: RGB = [247, 242, 231];
const PAPER2: RGB = [240, 233, 216];
const GREY: RGB = [105, 110, 116];
const FAINT: RGB = [176, 168, 148];
const DESK: RGB = [42, 52, 66];
const SKIN: RGB = [214, 178, 140];
const SKIN2: RGB = [198, 158, 122];
const HAIR: RGB = [58, 44, 34];
const SUIT: RGB = [44, 62, 92];
const PHOTO_BG: RGB = [168, 188, 198];

function px(x: number, y: number, c: RGB): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(H, Math.ceil(y + h)); j++)
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(W, Math.ceil(x + w)); i++) px(i, j, c);
}
function hline(x0: number, x1: number, y: number, c: RGB): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: RGB): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const t = (y - cy) / ry;
    if (Math.abs(t) > 1) continue;
    const dx = rx * Math.sqrt(1 - t * t);
    hline(Math.ceil(cx - dx), Math.floor(cx + dx), y, c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 0.6) {
    const rad = (a * Math.PI) / 180;
    px(cx + r * Math.cos(rad), cy + r * Math.sin(rad), c);
  }
}
function polyFill(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) hline(Math.ceil(xs[k]), Math.floor(xs[k + 1]), y, c);
  }
}
function star(cx: number, cy: number, r: number, c: RGB): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const rad = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)]);
  }
  polyFill(pts, c);
}

// ---- 5x7 bitmap font ('#' = on) ----
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "...#.", "..#..", ".#...", "#...."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  "(": ["...#.", "..#..", "..#..", "..#..", "..#..", "..#..", "...#."],
  ")": [".#...", "..#..", "..#..", "..#..", "..#..", "..#..", ".#..."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "*": [".....", ".#.#.", ".###.", "#####", ".###.", ".#.#.", "....."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", "#..#.", "#...#"],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB, opts: { align?: "left" | "center" | "right"; angle?: number; spacing?: number } = {}): void {
  const up = s.toUpperCase();
  const sp = opts.spacing ?? 6;
  const w = up.length * sp * scale - scale;
  let ox = x;
  if (opts.align === "center") ox = x - w / 2;
  if (opts.align === "right") ox = x - w;
  const ang = ((opts.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  // With an angle and centre alignment, rotate about the text block's centre.
  const pivotX = opts.angle && opts.align === "center" ? x : ox;
  const pivotY = opts.angle && opts.align === "center" ? y + (7 * scale) / 2 : y;
  const baseLX = opts.angle && opts.align === "center" ? w / 2 : 0;
  const baseLY = opts.angle && opts.align === "center" ? (7 * scale) / 2 : 0;
  for (let ci = 0; ci < up.length; ci++) {
    const g = FONT[up[ci]] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let cc = 0; cc < 5; cc++) {
        if (g[r][cc] !== "#") continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const lx = ci * sp * scale + cc * scale + dx - baseLX;
            const ly = r * scale + dy - baseLY;
            const rx = lx * cos - ly * sin;
            const ry = lx * sin + ly * cos;
            px(pivotX + rx, pivotY + ry, c);
          }
        }
      }
    }
  }
}
// Small helper: one horizontal rule with a gap in the middle (document style).
function rule(x0: number, x1: number, y: number, c: RGB): void {
  hline(x0, x1, y, c);
  hline(x0, x1, y + 1, mix(c, PAPER, 0.5));
}

// ---- page dressing ----
function guilloche(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let row = 0; row < 9; row++) {
    const base = y0 + 14 + row * ((y1 - y0 - 28) / 8);
    for (let x = x0 + 4; x <= x1 - 4; x += 2) {
      const y = base + Math.sin((x - x0) / 26 + row * 1.1) * 5;
      px(x, y, c);
    }
  }
}
function paperGrain(x0: number, y0: number, x1: number, y1: number, seed: number): void {
  const rnd = mulberry32(seed);
  for (let n = 0; n < 2600; n++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    px(x, y, rnd() > 0.5 ? mix(PAPER, FAINT, 0.35) : mix(PAPER, [255, 255, 255], 0.6));
  }
}

// ---- coat of arms of Meridiana: shield, three waves, one star ----
function coatOfArms(cx: number, cy: number, s: number): void {
  // shield
  polyFill(
    [
      [cx - 26 * s, cy - 24 * s], [cx + 26 * s, cy - 24 * s],
      [cx + 26 * s, cy + 8 * s], [cx, cy + 30 * s], [cx - 26 * s, cy + 8 * s],
    ],
    NAVY,
  );
  // shield border
  polyFill(
    [
      [cx - 22 * s, cy - 20 * s], [cx + 22 * s, cy - 20 * s],
      [cx + 22 * s, cy + 6 * s], [cx, cy + 25 * s], [cx - 22 * s, cy + 6 * s],
    ],
    PAPER,
  );
  // three waves inside the shield
  for (let w = 0; w < 3; w++) {
    const wy = cy - 8 * s + w * 9 * s;
    for (let x = -18; x <= 18; x++) {
      const y = wy + Math.sin(x / 5) * 2.2 * s;
      px(cx + x * s, y, TEAL);
      px(cx + x * s, y + 1 * s, TEAL);
    }
  }
  // star above the waves
  star(cx, cy - 12 * s, 5 * s, GOLD);
  // laurel ticks either side
  for (let i = 0; i < 4; i++) {
    line(cx - 30 * s, cy - 16 * s + i * 9 * s, cx - 26 * s, cy - 13 * s + i * 9 * s, GOLD);
    line(cx + 30 * s, cy - 16 * s + i * 9 * s, cx + 26 * s, cy - 13 * s + i * 9 * s, GOLD);
  }
}

// ---- portrait: a stylised front-facing holder photo, drawn, not pasted ----
function portrait(x0: number, y0: number, w: number, h: number): void {
  fillRect(x0, y0, w, h, PHOTO_BG);
  // faint diagonal guilloche in the photo background
  for (let d = -h; d < w + h; d += 9) {
    for (let t = 0; t < h; t++) {
      const x = x0 + d + t * 0.35;
      if (x >= x0 && x < x0 + w) px(x, y0 + t, mix(PHOTO_BG, [255, 255, 255], 0.35));
    }
  }
  const cx = x0 + w / 2;
  const headCy = y0 + h * 0.40;
  const headRx = w * 0.27, headRy = h * 0.26;
  // shoulders / suit
  polyFill(
    [
      [cx - w * 0.44, y0 + h], [cx - w * 0.40, y0 + h * 0.78],
      [cx - w * 0.13, y0 + h * 0.66], [cx + w * 0.13, y0 + h * 0.66],
      [cx + w * 0.40, y0 + h * 0.78], [cx + w * 0.44, y0 + h],
    ],
    SUIT,
  );
  // shirt V and tie
  polyFill([[cx - w * 0.13, y0 + h * 0.66], [cx + w * 0.13, y0 + h * 0.66], [cx, y0 + h * 0.86]], [245, 244, 238]);
  polyFill([[cx - 5, y0 + h * 0.68], [cx + 5, y0 + h * 0.68], [cx + 7, y0 + h * 0.86], [cx, y0 + h * 0.98], [cx - 7, y0 + h * 0.86]], BURG);
  // neck
  fillRect(cx - w * 0.09, headCy + headRy * 0.55, w * 0.18, h * 0.16, SKIN2);
  // ears
  fillEllipse(cx - headRx - 2, headCy, 5, 9, SKIN);
  fillEllipse(cx + headRx + 2, headCy, 5, 9, SKIN);
  // head
  fillEllipse(cx, headCy, headRx, headRy, SKIN);
  // jaw shading
  fillEllipse(cx, headCy + headRy * 0.42, headRx * 0.72, headRy * 0.5, mix(SKIN, SKIN2, 0.45));
  // hair: cap + side sweep
  for (let a = 180; a <= 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    const ex = cx + headRx * Math.cos(rad);
    const ey = headCy + headRy * Math.sin(rad) * 0.92 - 2;
    line(cx, headCy - headRy * 0.55, Math.round(ex), Math.round(ey), HAIR);
  }
  fillEllipse(cx, headCy - headRy * 0.72, headRx * 0.98, headRy * 0.42, HAIR);
  polyFill([[cx - headRx, headCy - headRy * 0.5], [cx - headRx * 0.55, headCy - headRy * 1.02], [cx + headRx * 0.5, headCy - headRy * 0.98], [cx + headRx, headCy - headRy * 0.42]], HAIR);
  // brows, eyes, nose, mouth
  const eyeY = headCy - headRy * 0.08;
  const eyeDX = headRx * 0.42;
  fillRect(cx - eyeDX - 9, eyeY - 8, 18, 3, HAIR);
  fillRect(cx + eyeDX - 9, eyeY - 8, 18, 3, HAIR);
  fillEllipse(cx - eyeDX, eyeY, 4.5, 3, [250, 250, 248]);
  fillEllipse(cx + eyeDX, eyeY, 4.5, 3, [250, 250, 248]);
  fillEllipse(cx - eyeDX, eyeY, 2.2, 2.6, [38, 32, 26]);
  fillEllipse(cx + eyeDX, eyeY, 2.2, 2.6, [38, 32, 26]);
  line(cx, eyeY + 6, cx - 2, eyeY + 16, mix(SKIN, SKIN2, 0.6));
  line(cx - 2, eyeY + 16, cx + 3, eyeY + 17, mix(SKIN, SKIN2, 0.6));
  hline(cx - 8, cx + 8, headCy + headRy * 0.58, [150, 92, 82]);
  hline(cx - 6, cx + 6, headCy + headRy * 0.58 + 1, [178, 118, 104]);
  // soft cheek shadow
  fillEllipse(cx - headRx * 0.55, headCy + headRy * 0.3, 7, 4, mix(SKIN, [226, 150, 130], 0.3));
  fillEllipse(cx + headRx * 0.55, headCy + headRy * 0.3, 7, 4, mix(SKIN, [226, 150, 130], 0.3));
}

// ---- MRZ (ICAO 9303) with real check digits, weights 7-3-1 ----
function mrzValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0; // '<'
}
function mrzCheck(s: string): string {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * w[i % 3];
  return String(sum % 10);
}
function mrzLines(): [string, string] {
  const docNo = "MD4829137";
  const dob = "920414"; // 14 Apr 1992
  const exp = "340311"; // 11 Mar 2034
  const line1 = ("P<MDIVOSS<<MARA<SELIN" + "<".repeat(44)).slice(0, 44);
  const body2 = docNo + mrzCheck(docNo) + "MDI" + dob + mrzCheck(dob) + "F" + exp + mrzCheck(exp);
  const optional = "<".repeat(15);
  const line2 = body2 + optional + mrzCheck(body2 + optional);
  return [line1, line2];
}

// ---- stamps ----
function roundStamp(cx: number, cy: number, r: number, c: RGB, top: string, mid: string, bottom: string, angle: number): void {
  circle(cx, cy, r, c);
  circle(cx, cy, r - 4, c);
  // date bar across the middle
  fillRect(cx - r + 5, cy - 7, (r - 5) * 2, 14, PAPER);
  drawText(mid, cx, cy - 5, 1, c, { align: "center" });
  drawText(top, cx, cy - r + 18, 1, c, { align: "center", angle });
  drawText(bottom, cx, cy + r - 25, 1, c, { align: "center", angle });
}
function rectStamp(x: number, y: number, w: number, h: number, c: RGB, lines: string[], angle: number): void {
  // rotated rectangle frame
  const cx = x + w / 2, cy = y + h / 2;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const corners: Array<[number, number]> = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const rot = corners.map(([dx, dy]): [number, number] => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  for (let i = 0; i < 4; i++) line(Math.round(rot[i][0]), Math.round(rot[i][1]), Math.round(rot[(i + 1) % 4][0]), Math.round(rot[(i + 1) % 4][1]), c);
  lines.forEach((t, i) => {
    drawText(t, cx, cy - ((lines.length - 1) * 9) / 2 + i * 9, 1, c, { align: "center", angle });
  });
}

// ---- left page: data page ----
function leftPage(x0: number, y0: number, x1: number, y1: number): void {
  fillRect(x0, y0, x1 - x0, y1 - y0, PAPER);
  guilloche(x0, y0, x1, y1, mix(PAPER, [170, 190, 205], 0.45));
  paperGrain(x0, y0, x1, y1, 20261121);
  const cx = (x0 + x1) / 2;
  coatOfArms(cx, y0 + 52, 0.9);
  drawText("REPUBLIC OF MERIDIANA", cx, y0 + 88, 2, NAVY, { align: "center" });
  drawText("REPUBLIK MERIDIANA  -  PASSPORT — PASPOR", cx, y0 + 106, 1, GREY, { align: "center" });
  rule(x0 + 28, x1 - 28, y0 + 122, NAVY);
  drawText("TYPE / JENIS  P", x0 + 30, y0 + 132, 1, GREY);
  drawText("CODE / KODE  MDI", x0 + 200, y0 + 132, 1, GREY);
  drawText("PASSPORT NO / NO PASPOR  MD 4829137", x0 + 330, y0 + 132, 1, GREY);

  // photo
  const px0 = x0 + 30, py0 = y0 + 152, pw = 148, ph = 186;
  fillRect(px0 - 3, py0 - 3, pw + 6, ph + 6, INK);
  portrait(px0, py0, pw, ph);
  // embossed seal overlapping the photo's lower right corner
  circle(px0 + pw - 16, py0 + ph - 16, 17, GOLD);
  circle(px0 + pw - 16, py0 + ph - 16, 13, GOLD);
  star(px0 + pw - 16, py0 + ph - 16, 6, GOLD);
  drawText("PHOTO / FOTO", px0 + pw / 2, py0 + ph + 10, 1, GREY, { align: "center" });

  // data fields, right of the photo
  const fx = x0 + 205;
  const rows: Array<[string, string, number]> = [
    ["SURNAME / NAMA KELUARGA", "VOSS", 2],
    ["GIVEN NAMES / NAMA", "MARA SELIN", 2],
    ["NATIONALITY / KEWARGANEGARAAN", "MERIDIANA", 2],
    ["DATE OF BIRTH / TGL LAHIR", "14 APR 1992", 2],
    ["PLACE OF BIRTH / TMP LAHIR", "PORT AURELIA", 2],
    ["SEX / KELAMIN  F", "DATE OF ISSUE / TGL TERBIT  12 MAR 2024", 1],
    ["DATE OF EXPIRY / BERLAKU S.D.", "11 MAR 2034", 2],
    ["AUTHORITY / OTORITAS", "PORT AURELIA", 2],
  ];
  let ry = y0 + 152;
  for (const [label, value, scale] of rows) {
    drawText(label, fx, ry, 1, GREY);
    drawText(value, fx, ry + 10, scale, INK);
    ry += scale === 2 ? 32 : 28;
  }
  // signature squiggle
  const sigY = y0 + 414;
  drawText("HOLDER'S SIGNATURE / TTD PEMEGANG", fx, sigY, 1, GREY);
  let sx = fx;
  for (let t = 0; t < 150; t += 2) {
    const yy = sigY + 16 + Math.sin(t / 9) * 4 - (t / 150) * 3;
    px(sx + t, yy, INK);
    px(sx + t, yy + 1, INK);
  }
  line(fx, sigY + 26, fx + 150, sigY + 26, FAINT);

  // MRZ
  const [l1, l2] = mrzLines();
  drawText(l1, x0 + 30, y1 - 46, 2, INK, { spacing: 7 });
  drawText(l2, x0 + 30, y1 - 28, 2, INK, { spacing: 7 });
  drawText("12", x1 - 22, y1 - 18, 1, GREY, { align: "right" });
}

// ---- right page: visas and stamps ----
function rightPage(x0: number, y0: number, x1: number, y1: number): void {
  fillRect(x0, y0, x1 - x0, y1 - y0, PAPER2);
  guilloche(x0, y0, x1, y1, mix(PAPER2, [170, 190, 205], 0.4));
  paperGrain(x0, y0, x1, y1, 77031);
  const cx = (x0 + x1) / 2;
  drawText("VISAS", cx, y0 + 26, 2, NAVY, { align: "center" });
  drawText("VISA - CAP MASUK — KELUAR", cx, y0 + 44, 1, GREY, { align: "center" });
  rule(x0 + 28, x1 - 28, y0 + 60, NAVY);

  // Kestrelia visa sticker, slightly tilted
  const vx = x0 + 52, vy = y0 + 76, vw = 250, vh = 148;
  fillRect(vx - 2, vy - 2, vw + 4, vh + 4, TEAL);
  fillRect(vx, vy, vw, vh, [222, 236, 228]);
  drawText("KESTRELIA — VISITOR VISA", vx + vw / 2, vy + 10, 1, TEAL, { align: "center" });
  rule(vx + 12, vx + vw - 12, vy + 26, TEAL);
  const vrows: Array<[string, string]> = [
    ["TYPE", "TOURIST — MULTIPLE"],
    ["VALID", "01 JUN 2024 — 30 NOV 2024"],
    ["STAY", "MAX 30 DAYS EACH ENTRY"],
    ["NO.", "KV-2024-11873"],
  ];
  let vy2 = vy + 36;
  for (const [k, v] of vrows) {
    drawText(k, vx + 12, vy2, 1, GREY);
    drawText(v, vx + 76, vy2, 1, INK);
    vy2 += 16;
  }
  // the telling condition, in red-brown
  drawText("CONDITION: NO EMPLOYMENT.", vx + 12, vy2 + 2, 1, BURG);
  drawText("HOLDER MAY NOT WORK IN", vx + 12, vy2 + 14, 1, BURG);
  drawText("KESTRELIA. FEE PAID 40 KR.", vx + 12, vy2 + 26, 1, BURG);
  // visa serial down the side
  drawText("KV11873", vx + vw - 8, vy + 34, 1, TEAL, { angle: 90 });

  // stamps: all dated after the 12 Mar 2024 issue, in travel order
  roundStamp(x0 + 360, y0 + 130, 46, TEAL, "KESTRELIA", "08 JUN 2024", "ENTRY", -8);
  roundStamp(x0 + 360, y0 + 236, 46, BURG, "KESTRELIA", "21 JUN 2024", "EXIT", 7);
  rectStamp(x0 + 60, y0 + 252, 210, 74, NAVY, ["VARDONIA — ENTRY", "03 SEP 2025 - PORT NARA", "STAY 14 DAYS"], -4);
  rectStamp(x0 + 60, y0 + 348, 210, 74, BURG, ["VARDONIA — EXIT", "17 SEP 2025 - PORT NARA", "SEE VISA KV-2024-11873"], 3);
  // home arrival + departure-tax fee stamp
  roundStamp(x0 + 360, y0 + 356, 44, NAVY, "MERIDIANA", "18 SEP 2025", "ARRIVAL", -6);
  rectStamp(x0 + 300, y0 + 448, 150, 52, GOLD, ["DEPARTURE TAX", "PAID — 12 AUR"], 5);

  drawText("THIS PASSPORT CONTAINS 32 PAGES. IF FOUND,", x0 + 30, y1 - 34, 1, GREY);
  drawText("RETURN TO THE NEAREST MERIDIAN CONSULATE.", x0 + 30, y1 - 22, 1, GREY);
  drawText("13", x1 - 22, y1 - 18, 1, GREY, { align: "right" });
}

// ---- spread assembly ----
function drawSpread(): void {
  fillRect(0, 0, W, H, DESK);
  // desk vignette: darker corners
  const rnd = mulberry32(99);
  for (let n = 0; n < 900; n++) {
    const x = rnd() * W, y = rnd() * H;
    px(x, y, mix(DESK, [20, 26, 36], 0.4));
  }
  const sx0 = 32, sy0 = 40, sx1 = 992, sy1 = 600;
  // drop shadow
  fillRect(sx0 + 6, sy0 + 8, sx1 - sx0, sy1 - sy0, [18, 24, 34]);
  // cover edge peeking out at the left
  fillRect(sx0 - 8, sy0 - 6, 14, sy1 - sy0 + 12, NAVY);
  fillRect(sx0 - 8, sy0 - 6, 14, 4, GOLD);
  leftPage(sx0, sy0, 512, sy1);
  rightPage(512, sy0, sx1, sy1);
  // centre fold: shadow + highlight
  fillRect(508, sy0, 4, sy1 - sy0, mix(PAPER, [120, 110, 90], 0.45));
  fillRect(512, sy0, 2, sy1 - sy0, [255, 252, 244]);
  // outer border of the spread
  for (let x = sx0; x < sx1; x++) { px(x, sy0, GOLD); px(x, sy1 - 1, GOLD); }
  for (let y = sy0; y < sy1; y++) { px(sx0, y, GOLD); px(sx1 - 1, y, GOLD); }
}

// ---- minimal PNG writer: filter 0, zlib, CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length), 0);
  dv.setUint32(8 + data.length, crc32(crcData));
  return out;
}
function writePng(path: string): void {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  writeFileSync(path, out);
}

function main(): void {
  drawSpread();
  mkdirSync("/output", { recursive: true });
  writePng("/output/entry.png");
  const [l1, l2] = mrzLines();
  console.log(`wrote /output/entry.png ${W}x${H}`);
  console.log(`MRZ: ${l1} / ${l2}`);
}
main();
