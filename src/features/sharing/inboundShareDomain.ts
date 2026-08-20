import type { ResolvedSharePayload } from 'expo-sharing';

import {
  devreChatDocumentMimeTypes,
  normalizeSelectedChatDocument,
  type DevreChatDocumentExtension,
} from '@/features/groups/chatDomain';

export const DEVRE_CHAT_IMAGE_INPUT_MAX_BYTES = 25 * 1024 * 1024;

const imageExtensionsByMime = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
} as const;

const documentExtensionByMime = Object.fromEntries(
  Object.entries(devreChatDocumentMimeTypes).map(([extension, mimeType]) => [mimeType, extension]),
) as Record<string, DevreChatDocumentExtension>;

export type PendingInboundAttachment =
  | { kind: 'image'; fileName: string; mimeType: keyof typeof imageExtensionsByMime; sizeBytes: number; uri: string }
  | { kind: 'document'; extension: DevreChatDocumentExtension; fileName: string; mimeType: string; sizeBytes: number; uri: string };

export interface PendingInboundShare {
  attachment: PendingInboundAttachment;
  destination: { kind: 'canonicalDevreGroup' };
  fingerprint: string;
  source: 'androidShare';
}

export function sanitizeInboundFileName(value: string): string {
  const normalized = value.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim();
  return normalized.slice(0, 120);
}

function extensionOf(fileName: string): string | null {
  const extension = fileName.split('.').at(-1)?.toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : null;
}

function isUriInsideCache(uri: string, cacheUri: string): boolean {
  try {
    const fileUrl = new URL(uri);
    const cacheUrl = new URL(cacheUri);
    if (fileUrl.protocol !== 'file:' || cacheUrl.protocol !== 'file:') return false;
    const cachePath = decodeURIComponent(cacheUrl.pathname).replace(/\/+$/, '') + '/';
    return decodeURIComponent(fileUrl.pathname).startsWith(cachePath);
  } catch {
    return false;
  }
}

function hashFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeInboundShareMetadata(input: {
  actualSize: number;
  cacheUri: string;
  payload: ResolvedSharePayload;
}): PendingInboundShare {
  const { actualSize, cacheUri, payload } = input;
  if (!payload.contentUri || !isUriInsideCache(payload.contentUri, cacheUri)) throw new Error('unsafe-share-uri');
  if (!Number.isSafeInteger(actualSize) || actualSize <= 0) throw new Error('empty-share-file');

  const [rawMimeType = ''] = (payload.contentMimeType ?? payload.mimeType ?? '').toLowerCase().split(';', 1);
  const mimeType = rawMimeType.trim();
  const imageExtensions = imageExtensionsByMime[mimeType as keyof typeof imageExtensionsByMime];
  const documentExtension = documentExtensionByMime[mimeType];
  const fallbackExtension = imageExtensions?.[0] ?? documentExtension;
  if (!fallbackExtension) throw new Error('unsupported-share-type');

  const fallbackName = imageExtensions ? `paylasilan-gorsel.${fallbackExtension}` : `paylasilan-belge.${fallbackExtension}`;
  const fileName = sanitizeInboundFileName(payload.originalName ?? fallbackName) || fallbackName;
  const suppliedExtension = extensionOf(fileName);
  let attachment: PendingInboundAttachment;

  if (imageExtensions) {
    if (actualSize > DEVRE_CHAT_IMAGE_INPUT_MAX_BYTES) throw new Error('share-image-too-large');
    if (suppliedExtension && !(imageExtensions as readonly string[]).includes(suppliedExtension)) throw new Error('share-type-mismatch');
    attachment = { kind: 'image', fileName, mimeType: mimeType as keyof typeof imageExtensionsByMime, sizeBytes: actualSize, uri: payload.contentUri };
  } else {
    if (!documentExtension) throw new Error('unsupported-share-type');
    if (suppliedExtension && suppliedExtension !== documentExtension) throw new Error('share-type-mismatch');
    const document = normalizeSelectedChatDocument({ mimeType, name: suppliedExtension ? fileName : fallbackName, size: actualSize, uri: payload.contentUri });
    attachment = { kind: 'document', ...document };
  }

  return {
    attachment,
    destination: { kind: 'canonicalDevreGroup' },
    fingerprint: hashFingerprint(`${payload.value}|${mimeType}|${fileName}|${actualSize}`),
    source: 'androidShare',
  };
}

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export function validateImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/webp') return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  return false;
}

const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16) | ((bytes[offset + 3] ?? 0) << 24)) >>> 0;
}

export function readZipEntryNames(bytes: Uint8Array): Set<string> | null {
  const minimum = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (readUint32(bytes, index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) return null;
  const entryCount = readUint16(bytes, eocd + 10);
  const centralSize = readUint32(bytes, eocd + 12);
  const centralOffset = readUint32(bytes, eocd + 16);
  if (centralOffset + centralSize > eocd || entryCount > 10_000) return null;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const names = new Set<string>();
  let offset = centralOffset;
  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (readUint32(bytes, offset) !== 0x02014b50) return null;
      const nameLength = readUint16(bytes, offset + 28);
      const extraLength = readUint16(bytes, offset + 30);
      const commentLength = readUint16(bytes, offset + 32);
      const end = offset + 46 + nameLength;
      if (end > bytes.length) return null;
      const name = decoder.decode(bytes.slice(offset + 46, end)).replace(/\\/g, '/');
      if (!name || name.startsWith('/') || name.split('/').includes('..')) return null;
      names.add(name);
      offset = end + extraLength + commentLength;
    }
  } catch {
    return null;
  }
  return names;
}

export function validateDocumentSignature(extension: DevreChatDocumentExtension, bytes: Uint8Array): boolean {
  if (extension === 'pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (extension === 'doc' || extension === 'xls' || extension === 'ppt') return startsWith(bytes, oleSignature);
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;
  const entries = readZipEntryNames(bytes);
  if (!entries?.has('[Content_Types].xml') || !entries.has('_rels/.rels')) return false;
  if (extension === 'docx') return entries.has('word/document.xml');
  if (extension === 'xlsx') return entries.has('xl/workbook.xml');
  return entries.has('ppt/presentation.xml');
}

export function inboundShareErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'document-too-large') return 'Belge en fazla 20 MB olabilir.';
  if (code === 'share-image-too-large') return 'Paylaşılan görsel en fazla 25 MB olabilir.';
  if (code === 'empty-share-file') return 'Paylaşılan dosya boş veya okunamıyor.';
  if (code === 'unsafe-share-uri') return 'Paylaşılan dosyaya güvenli biçimde erişilemedi.';
  if (code === 'share-type-mismatch' || code === 'invalid-file-signature') return 'Dosyanın içeriği, uzantısı ve türü birbiriyle eşleşmiyor.';
  if (code === 'multiple-share-not-supported') return 'Aynı anda yalnızca bir dosya paylaşabilirsin.';
  return 'Bu dosya türü Devrem tarafından desteklenmiyor.';
}
