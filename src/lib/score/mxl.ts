import { unzipSync } from "fflate";
import { inspectMusicXmlSafety, type MusicXmlParseResult, parseMusicXml } from "./musicxml.ts";

export const MXL_MAX_COMPRESSED_BYTES = 10 * 1024 * 1024;
export const MXL_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const MXL_MAX_ENTRIES = 128;

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function normalizeEntryPath(path: string): string | undefined {
  if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/")) return undefined;
  const parts = path.split("/");
  if (parts.some((part) => part === "..")) return undefined;
  const normalized = parts.filter((part) => part && part !== ".").join("/");
  return normalized || undefined;
}

function inspectLocalHeaders(bytes: Uint8Array): string | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  let count = 0;
  while (offset + 30 <= bytes.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) break;
    count += 1;
    if (count > MXL_MAX_ENTRIES) return "mxl_entry_limit";
    const flags = view.getUint16(offset + 6, true);
    if ((flags & 1) !== 0) return "mxl_encrypted";
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength > bytes.byteLength) return "malformed_mxl";
    if (!normalizeEntryPath(decoder.decode(bytes.subarray(nameStart, nameEnd)))) {
      return "mxl_unsafe_path";
    }
    // A data-descriptor archive has no local compressed size; fflate will validate it while
    // unpacking, but there is no safe way to continue this preflight scan without the descriptor.
    if (compressedSize === 0 && (flags & 8) !== 0) break;
    offset = nameEnd + extraLength + compressedSize;
  }
  return undefined;
}

function inspectCentralDirectory(bytes: Uint8Array): string | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= start; offset -= 1) {
    if (offset >= 0 && view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return "malformed_mxl";
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count === 0 || count > MXL_MAX_ENTRIES || centralOffset + centralSize > bytes.byteLength) {
    return count > MXL_MAX_ENTRIES ? "mxl_entry_limit" : "malformed_mxl";
  }
  const decoder = new TextDecoder();
  const names = new Set<string>();
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      return "malformed_mxl";
    }
    const flags = view.getUint16(offset + 8, true);
    if ((flags & 1) !== 0) return "mxl_encrypted";
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength + commentLength > bytes.byteLength) return "malformed_mxl";
    const normalized = normalizeEntryPath(decoder.decode(bytes.subarray(nameStart, nameEnd)));
    if (!normalized || names.has(normalized)) return "mxl_unsafe_path";
    names.add(normalized);
    // Unix external attributes encode the file type in the high mode bits. Reject symlinks
    // before decompression so an archive cannot redirect the container root.
    const madeBy = view.getUint16(offset + 4, true) >> 8;
    const externalAttributes = view.getUint32(offset + 38, true);
    if (madeBy === 3 && ((externalAttributes >>> 16) & 0xf000) === 0xa000) {
      return "mxl_symlink";
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MXL_MAX_UNCOMPRESSED_BYTES) return "mxl_uncompressed_limit";
    // A ZIP64 entry cannot be represented by the bounded 32-bit preflight fields.
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) return "malformed_mxl";
    offset = nameEnd + extraLength + commentLength;
  }
  return undefined;
}

function parseContainerXml(xml: string): { path?: string; issue?: string } {
  if (typeof DOMParser === "undefined") return { issue: "mxl_container_invalid" };
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    return { issue: "mxl_container_invalid" };
  }
  const rootFiles = Array.from(document.getElementsByTagName("rootfile"));
  if (rootFiles.length !== 1) return { issue: "mxl_root_ambiguous" };
  const path = rootFiles[0].getAttribute("full-path") || "";
  return path ? { path } : { issue: "mxl_root_missing" };
}

/** Unpack a MusicXML container with bounded resource use, then parse its root score. */
export function parseMxl(bytes: Uint8Array): MusicXmlParseResult {
  if (bytes.byteLength > MXL_MAX_COMPRESSED_BYTES) {
    return {
      issues: [{
        code: "mxl_size_limit",
        message: "MXL exceeds the 10 MiB compressed limit.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const headerIssue = inspectLocalHeaders(bytes);
  if (headerIssue) {
    const messages: Record<string, string> = {
      mxl_entry_limit: "MXL contains an unsupported number of entries.",
      mxl_encrypted: "Encrypted MXL entries are not supported.",
      mxl_unsafe_path: "MXL contains an unsafe path.",
      malformed_mxl: "MXL ZIP headers are malformed.",
    };
    return {
      issues: [{
        code: headerIssue,
        message: messages[headerIssue] || "MXL is invalid.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const centralIssue = inspectCentralDirectory(bytes);
  if (centralIssue) {
    const messages: Record<string, string> = {
      mxl_entry_limit: "MXL contains an unsupported number of entries.",
      mxl_encrypted: "Encrypted MXL entries are not supported.",
      mxl_unsafe_path: "MXL contains an unsafe or duplicate path.",
      mxl_symlink: "MXL symlink entries are not supported.",
      mxl_uncompressed_limit: "MXL exceeds the 32 MiB uncompressed limit.",
      malformed_mxl: "MXL ZIP central directory is malformed.",
    };
    return {
      issues: [{
        code: centralIssue,
        message: messages[centralIssue] || "MXL is invalid.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (_error) {
    return {
      issues: [{
        code: "malformed_mxl",
        message: "MXL ZIP container could not be unpacked.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const names = Object.keys(entries);
  if (names.length === 0 || names.length > MXL_MAX_ENTRIES) {
    return {
      issues: [{
        code: "mxl_entry_limit",
        message: "MXL contains an unsupported number of entries.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  let totalBytes = 0;
  const safeEntries = new Map<string, Uint8Array>();
  for (const name of names) {
    const normalized = normalizeEntryPath(name);
    if (!normalized || safeEntries.has(normalized)) {
      return {
        issues: [{
          code: "mxl_unsafe_path",
          message: "MXL contains an unsafe or duplicate path.",
          severity: "error",
          blocksGuidance: true,
        }],
      };
    }
    const data = entries[name];
    totalBytes += data.byteLength;
    if (totalBytes > MXL_MAX_UNCOMPRESSED_BYTES) {
      return {
        issues: [{
          code: "mxl_uncompressed_limit",
          message: "MXL exceeds the 32 MiB uncompressed limit.",
          severity: "error",
          blocksGuidance: true,
        }],
      };
    }
    safeEntries.set(normalized, data);
  }
  const container = safeEntries.get("META-INF/container.xml");
  if (!container) {
    return {
      issues: [{
        code: "mxl_container_missing",
        message: "MXL has no META-INF/container.xml.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const containerXml = decodeUtf8(container);
  if (!containerXml) {
    return {
      issues: [{
        code: "mxl_invalid_encoding",
        message: "MXL container.xml is not valid UTF-8.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const safetyIssue = inspectMusicXmlSafety(containerXml);
  if (safetyIssue) return { issues: [safetyIssue] };
  const rootResult = parseContainerXml(containerXml);
  if (rootResult.issue) {
    const message = rootResult.issue === "mxl_root_ambiguous"
      ? "MXL must contain exactly one container root score."
      : "MXL container.xml is malformed or has no root score.";
    return {
      issues: [{
        code: rootResult.issue,
        message,
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const scoreBytes = safeEntries.get(normalizeEntryPath(rootResult.path || "") || "");
  if (!scoreBytes) {
    return {
      issues: [{
        code: "mxl_root_missing",
        message: "MXL container points to a missing score file.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  const scoreXml = decodeUtf8(scoreBytes);
  if (!scoreXml) {
    return {
      issues: [{
        code: "mxl_invalid_encoding",
        message: "MXL score XML is not valid UTF-8.",
        severity: "error",
        blocksGuidance: true,
      }],
    };
  }
  return parseMusicXml(scoreXml);
}
