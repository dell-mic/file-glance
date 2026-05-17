import { expect, describe, it } from "bun:test"
import { readFileSync } from "node:fs"
import { extractZipFile } from "@/utils/zipExtractor"

describe("ZIP extraction", () => {
  it("should extract CSV files from ZIP archive", async () => {
    // Create a simple CSV content
    const csvContent1 = "Name,Age\nAlice,30\nBob,25"
    const csvContent2 = "City,Country\nNew York,USA\nLondon,UK"

    // Create Uint8Array for CSV files
    const csv1Bytes = new TextEncoder().encode(csvContent1)
    const csv2Bytes = new TextEncoder().encode(csvContent2)

    // Build a simple ZIP file manually
    // This is a minimal ZIP file with two stored (uncompressed) files
    const zipBuffer = createSimpleZip([
      { name: "file1.csv", content: csv1Bytes },
      { name: "file2.csv", content: csv2Bytes },
    ])

    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], "test.zip", {
      type: "application/zip",
    })

    const extractedFiles = await extractZipFile(zipFile)

    expect(extractedFiles.length).toBe(2)
    expect(extractedFiles[0].name).toBe("file1.csv")
    expect(extractedFiles[1].name).toBe("file2.csv")

    // Verify file contents
    const content1 = await extractedFiles[0].text()
    const content2 = await extractedFiles[1].text()

    expect(content1).toBe(csvContent1)
    expect(content2).toBe(csvContent2)
  })

  it("should skip directories in ZIP archive", async () => {
    const csvContent = "Name,Age\nAlice,30"
    const csvBytes = new TextEncoder().encode(csvContent)

    const zipBuffer = createSimpleZip([
      { name: "folder/", content: new Uint8Array(0) },
      { name: "folder/file.csv", content: csvBytes },
    ])

    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], "test.zip", {
      type: "application/zip",
    })

    const extractedFiles = await extractZipFile(zipFile)

    // Should only have the file, not the directory
    expect(extractedFiles.length).toBe(1)
    expect(extractedFiles[0].name).toBe("folder/file.csv")
  })

  it("should throw error if ZIP is empty", async () => {
    const zipBuffer = createSimpleZip([])

    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], "empty.zip", {
      type: "application/zip",
    })

    try {
      await extractZipFile(zipFile)
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).toBe("No files found in ZIP")
    }
  })

  it("should extract data descriptor ZIP entries without scanning file bytes", async () => {
    const content = new Uint8Array([65, 0x50, 0x4b, 0x07, 0x08, 66])
    const zipBuffer = createDataDescriptorZip(
      "signature-like-bytes.bin",
      content,
    )

    const zipFile = new File(
      [zipBuffer.buffer as ArrayBuffer],
      "descriptor.zip",
      {
        type: "application/zip",
      },
    )

    const extractedFiles = await extractZipFile(zipFile)
    const extractedContent = new Uint8Array(
      await extractedFiles[0].arrayBuffer(),
    )

    expect(extractedFiles.length).toBe(1)
    expect(extractedFiles[0].name).toBe("signature-like-bytes.bin")
    expect(Array.from(extractedContent)).toEqual(Array.from(content))
  })

  it("should reject multi-disk ZIP archives", async () => {
    const zipBuffer = createSimpleZip([
      { name: "file.csv", content: new TextEncoder().encode("a,b\n1,2") },
    ])
    const eocdOffset = zipBuffer.length - 22
    new DataView(zipBuffer.buffer).setUint16(eocdOffset + 4, 1, true)

    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], "multi.zip", {
      type: "application/zip",
    })

    try {
      await extractZipFile(zipFile)
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).toBe(
        "Multi-disk ZIP archives are not supported",
      )
    }
  })

  it("should extract BZIP2-compressed ZIP entries", async () => {
    const zipBuffer = readFileSync(
      new URL("../files/customers-100.zip", import.meta.url),
    )
    const zipFile = new File(
      [
        zipBuffer.buffer.slice(
          zipBuffer.byteOffset,
          zipBuffer.byteOffset + zipBuffer.byteLength,
        ) as ArrayBuffer,
      ],
      "customers-100.zip",
      {
        type: "application/zip",
      },
    )

    const extractedFiles = await extractZipFile(zipFile)
    const content = await extractedFiles[0].text()

    expect(extractedFiles.length).toBe(1)
    expect(extractedFiles[0].name).toBe("customers-100.csv")
    expect(content).toStartWith("Index,Customer Id,First Name")
    expect(content).toContain("DD37Cf93aecA6Dc")
  })
})

// Helper function to create a minimal ZIP file without deflate compression
function createSimpleZip(
  files: Array<{ name: string; content: Uint8Array }>,
): Uint8Array {
  const fileHeaders: Uint8Array[] = []
  const centralDirectory: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name)
    const isDirectory = file.name.endsWith("/")

    // Local file header
    const header = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(header.buffer)

    let pos = 0
    // Local file header signature
    view.setUint32(pos, 0x04034b50, true)
    pos += 4
    // Version needed to extract
    view.setUint16(pos, 0, true)
    pos += 2
    // General purpose bit flag
    view.setUint16(pos, 0, true)
    pos += 2
    // Compression method (0 = stored/no compression)
    view.setUint16(pos, 0, true)
    pos += 2
    // Last mod time
    view.setUint16(pos, 0, true)
    pos += 2
    // Last mod date
    view.setUint16(pos, 0, true)
    pos += 2
    // CRC-32
    view.setUint32(pos, isDirectory ? 0 : crc32(file.content), true)
    pos += 4
    // Compressed size
    view.setUint32(pos, file.content.length, true)
    pos += 4
    // Uncompressed size
    view.setUint32(pos, file.content.length, true)
    pos += 4
    // File name length
    view.setUint16(pos, nameBytes.length, true)
    pos += 2
    // Extra field length
    view.setUint16(pos, 0, true)
    pos += 2

    // File name
    header.set(nameBytes, pos)

    fileHeaders.push(header)
    if (!isDirectory) {
      fileHeaders.push(file.content)
    }

    // Central directory record
    const cdRecord = new Uint8Array(46 + nameBytes.length)
    const cdView = new DataView(cdRecord.buffer)

    pos = 0
    // Central directory signature
    cdView.setUint32(pos, 0x02014b50, true)
    pos += 4
    // Version made by
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Version needed to extract
    cdView.setUint16(pos, 0, true)
    pos += 2
    // General purpose bit flag
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Compression method
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Last mod time
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Last mod date
    cdView.setUint16(pos, 0, true)
    pos += 2
    // CRC-32
    cdView.setUint32(pos, isDirectory ? 0 : crc32(file.content), true)
    pos += 4
    // Compressed size
    cdView.setUint32(pos, file.content.length, true)
    pos += 4
    // Uncompressed size
    cdView.setUint32(pos, file.content.length, true)
    pos += 4
    // File name length
    cdView.setUint16(pos, nameBytes.length, true)
    pos += 2
    // Extra field length
    cdView.setUint16(pos, 0, true)
    pos += 2
    // File comment length
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Disk number start
    cdView.setUint16(pos, 0, true)
    pos += 2
    // Internal file attributes
    cdView.setUint16(pos, 0, true)
    pos += 2
    // External file attributes
    cdView.setUint32(pos, 0, true)
    pos += 4
    // Relative offset of local header
    cdView.setUint32(pos, offset, true)
    pos += 4

    // File name in central directory
    cdRecord.set(nameBytes, pos)

    centralDirectory.push(cdRecord)

    // Update offset for next file
    offset += header.length + file.content.length
  }

  // End of Central Directory
  const cdSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)

  let pos = 0
  // End of central directory signature
  eocdView.setUint32(pos, 0x06054b50, true)
  pos += 4
  // Disk number
  eocdView.setUint16(pos, 0, true)
  pos += 2
  // Disk with central directory
  eocdView.setUint16(pos, 0, true)
  pos += 2
  // Number of central directory records on this disk
  eocdView.setUint16(pos, files.length, true)
  pos += 2
  // Total number of central directory records
  eocdView.setUint16(pos, files.length, true)
  pos += 2
  // Size of central directory
  eocdView.setUint32(pos, cdSize, true)
  pos += 4
  // Offset of start of central directory
  eocdView.setUint32(pos, offset, true)
  pos += 4
  // ZIP file comment length
  eocdView.setUint16(pos, 0, true)

  // Combine all parts
  const totalSize =
    fileHeaders.reduce((sum, fh) => sum + fh.length, 0) + cdSize + eocd.length
  const result = new Uint8Array(totalSize)

  let resultOffset = 0
  for (const fh of fileHeaders) {
    result.set(fh, resultOffset)
    resultOffset += fh.length
  }
  for (const cd of centralDirectory) {
    result.set(cd, resultOffset)
    resultOffset += cd.length
  }
  result.set(eocd, resultOffset)

  return result
}

function createDataDescriptorZip(
  name: string,
  content: Uint8Array,
): Uint8Array {
  const nameBytes = new TextEncoder().encode(name)
  const crc = crc32(content)

  const header = new Uint8Array(30 + nameBytes.length)
  const headerView = new DataView(header.buffer)
  let pos = 0
  headerView.setUint32(pos, 0x04034b50, true)
  pos += 4
  headerView.setUint16(pos, 0, true)
  pos += 2
  headerView.setUint16(pos, 0x0008, true)
  pos += 2
  headerView.setUint16(pos, 0, true)
  pos += 2
  headerView.setUint16(pos, 0, true)
  pos += 2
  headerView.setUint16(pos, 0, true)
  pos += 2
  headerView.setUint32(pos, 0, true)
  pos += 4
  headerView.setUint32(pos, 0, true)
  pos += 4
  headerView.setUint32(pos, 0, true)
  pos += 4
  headerView.setUint16(pos, nameBytes.length, true)
  pos += 2
  headerView.setUint16(pos, 0, true)
  pos += 2
  header.set(nameBytes, pos)

  const descriptor = new Uint8Array(16)
  const descriptorView = new DataView(descriptor.buffer)
  descriptorView.setUint32(0, 0x08074b50, true)
  descriptorView.setUint32(4, crc, true)
  descriptorView.setUint32(8, content.length, true)
  descriptorView.setUint32(12, content.length, true)

  const centralDirectoryOffset =
    header.length + content.length + descriptor.length
  const cdRecord = new Uint8Array(46 + nameBytes.length)
  const cdView = new DataView(cdRecord.buffer)
  pos = 0
  cdView.setUint32(pos, 0x02014b50, true)
  pos += 4
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0x0008, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint32(pos, crc, true)
  pos += 4
  cdView.setUint32(pos, content.length, true)
  pos += 4
  cdView.setUint32(pos, content.length, true)
  pos += 4
  cdView.setUint16(pos, nameBytes.length, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint16(pos, 0, true)
  pos += 2
  cdView.setUint32(pos, 0, true)
  pos += 4
  cdView.setUint32(pos, 0, true)
  pos += 4
  cdRecord.set(nameBytes, pos)

  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  pos = 0
  eocdView.setUint32(pos, 0x06054b50, true)
  pos += 4
  eocdView.setUint16(pos, 0, true)
  pos += 2
  eocdView.setUint16(pos, 0, true)
  pos += 2
  eocdView.setUint16(pos, 1, true)
  pos += 2
  eocdView.setUint16(pos, 1, true)
  pos += 2
  eocdView.setUint32(pos, cdRecord.length, true)
  pos += 4
  eocdView.setUint32(pos, centralDirectoryOffset, true)
  pos += 4
  eocdView.setUint16(pos, 0, true)

  const result = new Uint8Array(
    header.length + content.length + descriptor.length + cdRecord.length + 22,
  )
  let resultOffset = 0
  result.set(header, resultOffset)
  resultOffset += header.length
  result.set(content, resultOffset)
  resultOffset += content.length
  result.set(descriptor, resultOffset)
  resultOffset += descriptor.length
  result.set(cdRecord, resultOffset)
  resultOffset += cdRecord.length
  result.set(eocd, resultOffset)

  return result
}

// Simple CRC32 implementation for testing
function crc32(data: Uint8Array): number {
  const polynomial = 0xedb88320
  let crc = 0xffffffff

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ polynomial
      } else {
        crc = crc >>> 1
      }
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}
