import { countTextTokens, defaultPrimaryTokenizer } from "../../../benchmarks/scripts/tokenizers.mjs";

export const primaryTokenizer = defaultPrimaryTokenizer;

export async function countTranscriptTokens(text) {
  const result = await countTextTokens(String(text), { tokenizer: primaryTokenizer });
  return {
    primaryTokenizer,
    transcriptTokens: result.tokens,
    characters: result.characters,
  };
}
