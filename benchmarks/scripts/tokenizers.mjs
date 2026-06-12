const APPROXIMATE_TOKENIZER = "approx-char-div-4";
const DEFAULT_PRIMARY_TOKENIZER = "tiktoken-o200k_base";

export const supportedTokenizers = [
  APPROXIMATE_TOKENIZER,
  DEFAULT_PRIMARY_TOKENIZER,
  "tiktoken-cl100k_base",
];

export const defaultPrimaryTokenizer = DEFAULT_PRIMARY_TOKENIZER;

function assertSupportedTokenizer(tokenizer) {
  if (!supportedTokenizers.includes(tokenizer)) {
    throw new Error(
      `Unsupported tokenizer '${tokenizer}'. Expected one of: ${supportedTokenizers.join(", ")}.`,
    );
  }
}

export function getTokenizerConfiguration({
  primaryTokenizer = process.env.DEVDECK_BENCHMARK_TOKENIZER ?? DEFAULT_PRIMARY_TOKENIZER,
  tokenizers,
} = {}) {
  assertSupportedTokenizer(primaryTokenizer);
  const selectedTokenizers = tokenizers ??
    (primaryTokenizer === APPROXIMATE_TOKENIZER
      ? [APPROXIMATE_TOKENIZER]
      : supportedTokenizers);

  for (const tokenizer of selectedTokenizers) {
    assertSupportedTokenizer(tokenizer);
  }
  if (!selectedTokenizers.includes(primaryTokenizer)) {
    throw new Error(`Primary tokenizer '${primaryTokenizer}' must be included in tokenizers.`);
  }

  return {
    primaryTokenizer,
    tokenizers: [...selectedTokenizers],
  };
}

function encodingName(tokenizer) {
  return tokenizer.replace("tiktoken-", "");
}

async function countWithTiktoken(text, tokenizer) {
  let tiktoken;
  try {
    tiktoken = await import("tiktoken");
  } catch (error) {
    throw new Error(
      `Unable to load the 'tiktoken' package for ${tokenizer}. Run 'npm install' or explicitly select '${APPROXIMATE_TOKENIZER}'.`,
      { cause: error },
    );
  }

  let encoding;
  try {
    encoding = tiktoken.get_encoding(encodingName(tokenizer));
    return encoding.encode(text).length;
  } catch (error) {
    throw new Error(
      `Unable to count tokens with ${tokenizer}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    encoding?.free();
  }
}

export async function countTextTokens(
  text,
  {
    tokenizer = DEFAULT_PRIMARY_TOKENIZER,
    model,
  } = {},
) {
  assertSupportedTokenizer(tokenizer);
  const source = String(text);
  const tokens = tokenizer === APPROXIMATE_TOKENIZER
    ? Math.ceil(source.length / 4)
    : await countWithTiktoken(source, tokenizer);

  return {
    tokenizer,
    model: model ?? null,
    tokens,
    characters: source.length,
  };
}

export async function countTextWithTokenizers(
  text,
  {
    tokenizers = supportedTokenizers,
    model,
  } = {},
) {
  const source = String(text);
  const counts = {};

  for (const tokenizer of tokenizers) {
    counts[tokenizer] = (await countTextTokens(source, { tokenizer, model })).tokens;
  }

  return {
    characters: source.length,
    tokens: counts,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = process.argv.slice(2).join(" ") || "DevDeck tokenizer sanity check";
  const result = await countTextWithTokenizers(sample);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
