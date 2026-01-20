/**
 * Purges and normalizes whitespace in text fragments
 * Ported from old plugin's PurgeWhiteSpace function
 */
export function purgeWhitespace(array: string[]): string[] {
  let fragment: string | undefined;
  let lTrimmed = false;
  let rTrimmed = false;
  const l = array.length;

  // Trim left side
  let i = 0;
  while (!lTrimmed && i !== l) {
    fragment = array[i] = array[i].trimStart();
    if (fragment) {
      lTrimmed = true;
    }
    i++;
  }

  // Trim right side
  i = l - 1;
  while (l && !rTrimmed && i !== -1) {
    fragment = array[i] = array[i].trimEnd();
    if (fragment) {
      rTrimmed = true;
    }
    i--;
  }

  // Normalize whitespace within fragments
  const r = /\s+$/g;
  let trailingSpace = true;
  i = 0;
  while (i !== l) {
    // Leave line breaks intact (Unicode line separator)
    if (array[i] !== '\u2028') {
      fragment = array[i].replace(/\s+/g, ' ');
      if (trailingSpace) {
        fragment = fragment.trimStart();
      }
      if (fragment) {
        trailingSpace = r.test(fragment);
      }
      array[i] = fragment;
    }
    i++;
  }

  return array;
}
