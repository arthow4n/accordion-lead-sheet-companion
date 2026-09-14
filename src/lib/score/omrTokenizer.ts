/**
 * Tokenizer and vocabulary utilities for JAZZMUS SMT model.
 *
 * Vocabulary is locked to JAZZMUS revision b38466e738548cf4d3826a0426d709a711533618 (MIT).
 */

import { JAZZMUS_VOCABULARY } from "./jazzmusVocab.ts";

export const OMR_SPECIAL_TOKENS = {
  PAD: "<pad>",
  BOS: "<bos>",
  EOS: "<eos>",
  TAB: "<t>",
  NEWLINE: "<n>",
  KERN: "**kern",
  MXHM: "**mxhm",
} as const;

export const OMR_TOKEN_IDS = {
  PAD: 0,
  BOS: 105,
  EOS: 87,
  TAB: 131,
  NEWLINE: 40,
  KERN: 141,
  MXHM: 72,
} as const;

const W2I: Map<string, number> = new Map();
const I2W: string[] = [];

for (let i = 0; i < JAZZMUS_VOCABULARY.length; i++) {
  const token = JAZZMUS_VOCABULARY[i];
  W2I.set(token, i);
  I2W.push(token);
}

/** Get token ID for a string token, or undefined if not in vocabulary. */
export function getTokenId(token: string): number | undefined {
  return W2I.get(token);
}

/** Get string token for a token ID, or undefined if out of bounds. */
export function getTokenString(id: number): string | undefined {
  return I2W[id];
}

/** Return total vocabulary size. */
export function getVocabularySize(): number {
  return I2W.length;
}

/**
 * Untokenize a sequence of string tokens according to upstream JAZZMUS tokenizer convention.
 *
 * Upstream replacement contract:
 * - `<t>` -> tab (`\t`)
 * - `<n>` -> newline (`\n`)
 * - `<s>` -> space (` `)
 * - `<chord-pitch>` -> stripped
 * - `<chord-extension>` -> stripped
 */
export function untokenize(tokens: readonly string[]): string {
  return tokens
    .join("")
    .replaceAll("<t>", "\t")
    .replaceAll("<n>", "\n")
    .replaceAll("<s>", " ")
    .replaceAll("<chord-pitch>", "")
    .replaceAll("<chord-extension>", "");
}

/**
 * Decode an array of integer token IDs into raw Humdrum text.
 * Omits `<bos>`, stops at `<eos>`, and handles `<pad>`.
 */
export function decodeTokenIds(tokenIds: readonly number[]): string {
  const strTokens: string[] = [];
  for (const id of tokenIds) {
    if (id === OMR_TOKEN_IDS.BOS) continue;
    if (id === OMR_TOKEN_IDS.EOS) break;
    if (id === OMR_TOKEN_IDS.PAD) continue;
    const str = getTokenString(id);
    if (str !== undefined) {
      strTokens.push(str);
    }
  }
  return untokenize(strTokens);
}
