/**
 * Converts a WOFF font file to raw TrueType (TTF) format.
 * jsPDF only accepts TTF, so WOFF fonts must be converted first.
 *
 * @param woffBuffer - ArrayBuffer containing the WOFF file data
 * @returns ArrayBuffer containing the TTF file data
 */
export async function woffToTtf(woffBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const view = new DataView(woffBuffer);

  // Verify WOFF1 signature: 0x774F4646 = "wOFF"
  const signature = view.getUint32(0);
  if (signature !== 0x774f4646) {
    throw new Error(
      'Not a valid WOFF file. If this is a WOFF2 file, it must be converted to TTF externally.'
    );
  }

  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);

  // Read WOFF table directory (starts at byte 44)
  const tables: Array<{
    tag: number;
    woffOffset: number;
    compLength: number;
    origLength: number;
    origChecksum: number;
  }> = [];
  let dirOffset = 44;
  for (let i = 0; i < numTables; i++) {
    tables.push({
      tag: view.getUint32(dirOffset),
      woffOffset: view.getUint32(dirOffset + 4),
      compLength: view.getUint32(dirOffset + 8),
      origLength: view.getUint32(dirOffset + 12),
      origChecksum: view.getUint32(dirOffset + 16),
    });
    dirOffset += 20;
  }

  // Calculate TTF header size: 12-byte sfnt header + 16-byte entries
  const ttfHeaderSize = 12 + numTables * 16;

  // Compute searchRange / entrySelector / rangeShift for the sfnt header
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const rangeShift = numTables * 16 - searchRange;

  // Decompress each table and measure total size (with 4-byte alignment)
  const decompressedTables: Uint8Array[] = [];
  let totalDataSize = ttfHeaderSize;
  for (const table of tables) {
    const raw = new Uint8Array(woffBuffer, table.woffOffset, table.compLength);
    let data: Uint8Array;

    if (table.compLength < table.origLength) {
      // DEFLATE-compressed — decompress via DecompressionStream
      data = await inflate(raw);
    } else {
      data = raw;
    }
    decompressedTables.push(data);
    totalDataSize += data.length;
    // Pad to 4-byte boundary
    const pad = (4 - (data.length % 4)) % 4;
    totalDataSize += pad;
  }

  // Build the TTF buffer
  const ttf = new ArrayBuffer(totalDataSize);
  const ttfView = new DataView(ttf);
  const ttfBytes = new Uint8Array(ttf);

  // sfnt header
  ttfView.setUint32(0, flavor);
  ttfView.setUint16(4, numTables);
  ttfView.setUint16(6, searchRange);
  ttfView.setUint16(8, entrySelector);
  ttfView.setUint16(10, rangeShift);

  // Write table directory entries + table data
  let dataOffset = ttfHeaderSize;
  for (let i = 0; i < numTables; i++) {
    const table = tables[i];
    const data = decompressedTables[i];

    // Table directory entry (16 bytes)
    const entryOffset = 12 + i * 16;
    ttfView.setUint32(entryOffset, table.tag);
    ttfView.setUint32(entryOffset + 4, table.origChecksum);
    ttfView.setUint32(entryOffset + 8, dataOffset);
    ttfView.setUint32(entryOffset + 12, table.origLength);

    // Table data
    ttfBytes.set(data, dataOffset);
    dataOffset += data.length;
    // 4-byte pad
    const pad = (4 - (data.length % 4)) % 4;
    dataOffset += pad;
  }

  return ttf;
}

/**
 * Decompresses DEFLATE-raw data using the browser DecompressionStream API.
 */
async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
