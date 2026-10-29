// Left-hand digits come in two encodings (L and G); the first digit of the code picks the pattern.
// R is L with the bits inverted and G is R read backwards, so only L is written out.
const L_CODES = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const invert = (bits: string) => [...bits].map((bit) => (bit === "0" ? "1" : "0")).join("");
const R_CODES = L_CODES.map(invert);
const G_CODES = R_CODES.map((bits) => [...bits].reverse().join(""));

const LEFT_PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

export const EAN13_MODULES = 95;
const START_GUARD = "101";
const MIDDLE_GUARD = "01010";
const END_GUARD = "101";

/** The 95 bars and spaces of an EAN-13 as a string of 1 (bar) and 0 (space). */
export function encodeEan13(code: string): string {
  if (!/^\d{13}$/.test(code)) throw new Error("EAN-13 needs exactly 13 digits");
  const digits = [...code].map(Number);
  const parity = LEFT_PARITY[digits[0]!]!;
  const left = digits
    .slice(1, 7)
    .map((digit, i) => (parity[i] === "L" ? L_CODES : G_CODES)[digit]!)
    .join("");
  const right = digits
    .slice(7)
    .map((digit) => R_CODES[digit]!)
    .join("");
  return START_GUARD + left + MIDDLE_GUARD + right + END_GUARD;
}
