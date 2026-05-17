/**
 * ZIP extraction utility using native browser APIs only
 * Uses Compression Streams API for decompression
 */
import Bunzip from "seek-bzip"

interface LocalFileHeader {
  signature: number
  version: number
  flags: number
  compression: number
  modTime: number
  modDate: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  fileNameLength: number
  extraFieldLength: number
  fileName: string
  fileData: Uint8Array
}

interface CentralDirectory {
  signature: number
  diskNumber: number
  diskWithCD: number
  entriesOnDisk: number
  totalEntries: number
  cdSize: number
  cdOffset: number
  commentLength: number
}

interface CentralDirectoryEntry {
  flags: number
  compression: number
  modTime: number
  modDate: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  fileName: string
  localHeaderOffset: number
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50
const COMPRESSION_STORE = 0
const COMPRESSION_DEFLATE = 8
const COMPRESSION_BZIP2 = 12

class DataViewReader {
  private view: DataView
  private offset: number = 0
  public buffer: ArrayBuffer

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
    this.buffer = buffer
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset)
    this.offset += 1
    return value
  }

  readUint16LE(): number {
    const value = this.view.getUint16(this.offset, true)
    this.offset += 2
    return value
  }

  readUint32LE(): number {
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.offset, length)
    this.offset += length
    return bytes
  }

  readString(length: number): string {
    const bytes = this.readBytes(length)
    return new TextDecoder().decode(bytes)
  }

  seek(offset: number): void {
    this.offset = offset
  }

  tell(): number {
    return this.offset
  }

  remaining(): number {
    return this.view.byteLength - this.offset
  }
}

async function decompressDeflate(
  compressedData: Uint8Array,
): Promise<Uint8Array> {
  //   try {
  return await decompressDeflateInternal(compressedData, "deflate-raw")
  //   } catch (error) {
  //     console.warn(`Rw deflate failed, trying standard deflate:`, error)
  //     // Try raw deflate as fallback
  //     try {
  //       return await decompressDeflateInternal(compressedData, "deflate")
  //     } catch (rawError) {
  //       console.error(`Both deflate methods failed:`, rawError)
  //       throw rawError
  //     }
  //   }
}

function decompressBzip2(
  compressedData: Uint8Array,
  uncompressedSize: number,
): Uint8Array {
  try {
    const output = new Uint8Array(uncompressedSize)
    const decompressed = Bunzip.decode(compressedData, output)
    return decompressed instanceof Uint8Array
      ? decompressed
      : new Uint8Array(decompressed)
  } catch (error) {
    console.error(
      `BZIP2 decompression failed for ${compressedData.length} bytes:`,
      error,
    )
    throw new Error(
      `Failed to decompress bzip2 data: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function decompressDeflateInternal(
  compressedData: Uint8Array,
  format: "deflate" | "deflate-raw",
): Promise<Uint8Array> {
  try {
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(compressedData)
        controller.close()
      },
    })

    const decompressor = new DecompressionStream(format)
    const decompressed = readable.pipeThrough(
      decompressor as ReadableWritablePair<Uint8Array, Uint8Array>,
    )

    const reader = decompressed.getReader()
    const chunks: Uint8Array[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    // Combine chunks into single array
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  } catch (error) {
    console.error(
      `Decompression failed (${format}) for ${compressedData.length} bytes:`,
      error,
    )
    throw new Error(
      `Failed to decompress ${format} data: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function parseLocalFileHeader(
  reader: DataViewReader,
  centralDirectoryEntry?: CentralDirectoryEntry,
): LocalFileHeader {
  const signature = reader.readUint32LE()
  if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(
      `Invalid local file header signature: 0x${signature.toString(16)}`,
    )
  }

  const version = reader.readUint16LE()
  const flags = reader.readUint16LE()
  const compression = reader.readUint16LE()
  const modTime = reader.readUint16LE()
  const modDate = reader.readUint16LE()
  const crc32 = reader.readUint32LE()
  const compressedSize = reader.readUint32LE()
  const uncompressedSize = reader.readUint32LE()
  const fileNameLength = reader.readUint16LE()
  const extraFieldLength = reader.readUint16LE()

  const fileName = reader.readString(fileNameLength)
  reader.readBytes(extraFieldLength) // Skip extra field

  // Check bit 3 of flags - indicates data descriptor is used
  const hasDataDescriptor = (flags & 0x0008) !== 0

  let actualCompressedSize =
    centralDirectoryEntry?.compressedSize ?? compressedSize
  let actualUncompressedSize =
    centralDirectoryEntry?.uncompressedSize ?? uncompressedSize
  let fileData: Uint8Array

  if (hasDataDescriptor && centralDirectoryEntry) {
    if (reader.tell() + actualCompressedSize > reader.buffer.byteLength) {
      throw new Error(
        `Not enough data for file ${fileName}: expected ${actualCompressedSize} bytes but only ${
          reader.buffer.byteLength - reader.tell()
        } bytes available`,
      )
    }

    fileData = reader.readBytes(actualCompressedSize)
  } else if (hasDataDescriptor && compressedSize === 0) {
    console.log(`File ${fileName} uses data descriptors, scanning for data...`)
    // Data descriptor is used, need to find the data descriptor signature
    const dataStart = reader.tell()
    const scanStart = dataStart
    let foundSize = 0

    // Scan for data descriptor signature (0x08074b50)
    // The data descriptor comes after the file data
    const buffer = new Uint8Array(
      reader.buffer,
      scanStart,
      Math.min(10000000, reader.buffer.byteLength - scanStart), // Scan up to 10MB ahead
    )

    let descriptorPos = -1
    for (let i = 0; i < buffer.length - 3; i++) {
      const sig =
        buffer[i] |
        (buffer[i + 1] << 8) |
        (buffer[i + 2] << 16) |
        (buffer[i + 3] << 24)
      if (sig === DATA_DESCRIPTOR_SIGNATURE) {
        descriptorPos = i
        break
      }
    }

    if (descriptorPos === -1) {
      // Data descriptor not found, try to find next local file header or central directory
      descriptorPos = buffer.length - 4
      for (let i = buffer.length - 4; i > 0; i--) {
        const sig =
          buffer[i] |
          (buffer[i + 1] << 8) |
          (buffer[i + 2] << 16) |
          (buffer[i + 3] << 24)
        if (
          sig === LOCAL_FILE_HEADER_SIGNATURE ||
          sig === CENTRAL_DIRECTORY_SIGNATURE
        ) {
          descriptorPos = i
          break
        }
      }
    }

    foundSize = descriptorPos
    fileData = new Uint8Array(reader.buffer, dataStart, foundSize)
    actualCompressedSize = fileData.length

    // Try to read data descriptor if found
    reader.seek(dataStart + foundSize)
    if (
      reader.tell() < reader.buffer.byteLength - 4 &&
      reader.readUint32LE() === DATA_DESCRIPTOR_SIGNATURE
    ) {
      // Data descriptor found
      reader.readUint32LE() // CRC-32
      actualCompressedSize = reader.readUint32LE()
      actualUncompressedSize = reader.readUint32LE()
      console.log(
        `Data descriptor found: compressed=${actualCompressedSize}, uncompressed=${actualUncompressedSize}`,
      )
    } else {
      // No data descriptor, use scanned size
      actualUncompressedSize = foundSize
      reader.seek(dataStart + foundSize)
      console.log(
        `No data descriptor found, using scanned size: ${foundSize} bytes`,
      )
    }
  } else {
    // Normal case: sizes are in header
    // Validate that we have enough data
    if (reader.tell() + actualCompressedSize > reader.buffer.byteLength) {
      throw new Error(
        `Not enough data for file ${fileName}: expected ${actualCompressedSize} bytes but only ${
          reader.buffer.byteLength - reader.tell()
        } bytes available`,
      )
    }

    fileData = reader.readBytes(actualCompressedSize)
  }

  return {
    signature,
    version,
    flags,
    compression,
    modTime,
    modDate,
    crc32,
    compressedSize: actualCompressedSize,
    uncompressedSize: actualUncompressedSize,
    fileNameLength,
    extraFieldLength,
    fileName,
    fileData,
  }
}

function findEndOfCentralDirectory(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  // Search backwards from the end for the End of Central Directory signature
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_DIR_SIGNATURE) {
      return i
    }
  }
  throw new Error("End of Central Directory not found")
}

function parseCentralDirectory(
  reader: DataViewReader,
  endOfCDOffset: number,
): CentralDirectory {
  reader.seek(endOfCDOffset)

  const signature = reader.readUint32LE()
  if (signature !== END_OF_CENTRAL_DIR_SIGNATURE) {
    throw new Error(
      `Invalid end of central directory signature: 0x${signature.toString(16)}`,
    )
  }

  const diskNumber = reader.readUint16LE()
  const diskWithCD = reader.readUint16LE()
  const entriesOnDisk = reader.readUint16LE()
  const totalEntries = reader.readUint16LE()
  const cdSize = reader.readUint32LE()
  const cdOffset = reader.readUint32LE()
  const commentLength = reader.readUint16LE()

  return {
    signature,
    diskNumber,
    diskWithCD,
    entriesOnDisk,
    totalEntries,
    cdSize,
    cdOffset,
    commentLength,
  }
}

function validateCentralDirectory(cd: CentralDirectory): void {
  if (cd.diskNumber !== 0 || cd.diskWithCD !== 0) {
    throw new Error("Multi-disk ZIP archives are not supported")
  }

  if (cd.entriesOnDisk !== cd.totalEntries) {
    throw new Error("Multi-disk ZIP archives are not supported")
  }
}

function parseCentralDirectoryEntries(
  reader: DataViewReader,
  cd: CentralDirectory,
): CentralDirectoryEntry[] {
  const entries: CentralDirectoryEntry[] = []
  reader.seek(cd.cdOffset)

  for (let i = 0; i < cd.totalEntries; i++) {
    const signature = reader.readUint32LE()
    if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(
        `Invalid central directory entry signature: 0x${signature.toString(16)}`,
      )
    }

    reader.readUint16LE() // Version made by
    reader.readUint16LE() // Version needed to extract
    const flags = reader.readUint16LE()
    const compression = reader.readUint16LE()
    const modTime = reader.readUint16LE()
    const modDate = reader.readUint16LE()
    const crc32 = reader.readUint32LE()
    const compressedSize = reader.readUint32LE()
    const uncompressedSize = reader.readUint32LE()
    const fileNameLength = reader.readUint16LE()
    const extraFieldLength = reader.readUint16LE()
    const fileCommentLength = reader.readUint16LE()
    reader.readUint16LE() // Disk number start
    reader.readUint16LE() // Internal file attributes
    reader.readUint32LE() // External file attributes
    const localHeaderOffset = reader.readUint32LE()
    const fileName = reader.readString(fileNameLength)

    reader.readBytes(extraFieldLength)
    reader.readBytes(fileCommentLength)

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error("ZIP64 archives are not supported")
    }

    entries.push({
      flags,
      compression,
      modTime,
      modDate,
      crc32,
      compressedSize,
      uncompressedSize,
      fileName,
      localHeaderOffset,
    })
  }

  return entries
}

export async function extractZipFile(zipFile: File): Promise<File[]> {
  const buffer = await zipFile.arrayBuffer()
  const reader = new DataViewReader(buffer)

  const files: File[] = []

  console.log(
    `Extracting ZIP file: ${zipFile.name} (${buffer.byteLength} bytes)`,
  )

  // Find and parse End of Central Directory
  const endOfCDOffset = findEndOfCentralDirectory(buffer)
  console.log(`End of Central Directory at offset: ${endOfCDOffset}`)

  const cd = parseCentralDirectory(reader, endOfCDOffset)
  validateCentralDirectory(cd)
  console.log(
    `Central Directory: ${cd.totalEntries} entries, size ${cd.cdSize} bytes at offset ${cd.cdOffset}`,
  )

  const entries = parseCentralDirectoryEntries(reader, cd)

  for (const entry of entries) {
    try {
      // Skip directories
      if (entry.fileName.endsWith("/")) {
        console.log(`Skipping directory: ${entry.fileName}`)
        continue
      }

      // Skip __MACOSX entries (macOS metadata)
      if (entry.fileName.includes("__MACOSX")) {
        console.log(`Skipping __MACOSX entry: ${entry.fileName}`)
        continue
      }

      // Skip dotfiles (hidden files starting with .)
      const fileName = entry.fileName.split("/").pop() || ""
      if (fileName.startsWith(".")) {
        console.log(`Skipping dotfile: ${entry.fileName}`)
        continue
      }

      reader.seek(entry.localHeaderOffset)
      const header = parseLocalFileHeader(reader, entry)

      if (header.fileName !== entry.fileName) {
        throw new Error(
          `Central directory entry ${entry.fileName} does not match local file header ${header.fileName}`,
        )
      }

      // Decompress file data if needed
      let fileData = header.fileData
      if (header.compression === COMPRESSION_DEFLATE) {
        if (header.fileData.length === 0) {
          console.warn(
            `${header.fileName}: compression=8 but 0 bytes of data. Treating as empty.`,
          )
          fileData = new Uint8Array(0)
        } else {
          console.log(
            `Decompressing ${header.fileName}: ${header.compressedSize} bytes compressed -> ${header.uncompressedSize} bytes uncompressed`,
          )
          try {
            fileData = await decompressDeflate(header.fileData)
          } catch (decompressError) {
            console.error(
              `Decompression error for ${header.fileName}:`,
              decompressError,
            )
            console.log(
              `File header: compression=${header.compression}, compressedSize=${header.compressedSize}, uncompressedSize=${header.uncompressedSize}`,
            )
            console.log(
              `Actual data length: ${header.fileData.length}, first 16 bytes:`,
              Array.from(header.fileData.slice(0, 16))
                .map((b) => "0x" + b.toString(16).padStart(2, "0"))
                .join(" "),
            )
            throw decompressError
          }
        }
      } else if (header.compression === COMPRESSION_BZIP2) {
        if (header.fileData.length === 0) {
          console.warn(
            `${header.fileName}: compression=12 but 0 bytes of data. Treating as empty.`,
          )
          fileData = new Uint8Array(0)
        } else {
          console.log(
            `Decompressing ${header.fileName} with BZIP2: ${header.compressedSize} bytes compressed -> ${header.uncompressedSize} bytes uncompressed`,
          )
          fileData = decompressBzip2(header.fileData, header.uncompressedSize)
        }
      } else if (header.compression !== COMPRESSION_STORE) {
        throw new Error(
          `Unsupported compression method: ${header.compression} for file ${header.fileName}`,
        )
      }

      console.log(`Extracted: ${header.fileName} (${fileData.length} bytes)`)

      // Create File object - convert Uint8Array to ArrayBuffer for compatibility
      const fileBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength,
      ) as ArrayBuffer
      const file = new File([fileBuffer], header.fileName, {
        type: "application/octet-stream",
        lastModified: dosDateTimeToJavaScriptTime(
          header.modDate,
          header.modTime,
        ),
      })

      files.push(file)
    } catch (error) {
      console.error(
        `Error processing file at offset ${entry.localHeaderOffset}:`,
        error,
      )
      throw error
    }
  }

  if (files.length === 0) {
    throw new Error("No files found in ZIP")
  }

  console.log(`Successfully extracted ${files.length} files from ZIP`)
  return files
}

function dosDateTimeToJavaScriptTime(dosDate: number, dosTime: number): number {
  const day = dosDate & 0x1f
  const month = (dosDate >> 5) & 0x0f
  const year = ((dosDate >> 9) & 0x7f) + 1980

  const seconds = (dosTime & 0x1f) * 2
  const minutes = (dosTime >> 5) & 0x3f
  const hours = (dosTime >> 11) & 0x1f

  return new Date(year, month - 1, day, hours, minutes, seconds).getTime()
}
