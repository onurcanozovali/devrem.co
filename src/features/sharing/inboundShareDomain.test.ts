import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResolvedSharePayload } from 'expo-sharing';

import { DEVRE_CHAT_DOCUMENT_MAX_BYTES } from '@/features/groups/chatDomain';
import {
  normalizeInboundShareMetadata,
  readZipEntryNames,
  sanitizeInboundFileName,
  validateDocumentSignature,
  validateImageSignature,
} from './inboundShareDomain';
import {
  beginInboundShareSend,
  bindInboundShareToUser,
  clearInboundShareSession,
  releaseInboundShareSend,
} from './inboundShareSession';

function payload(overrides: Partial<ResolvedSharePayload> = {}): ResolvedSharePayload {
  return {
    contentMimeType: 'application/pdf',
    contentSize: 123,
    contentType: 'file',
    contentUri: 'file:///data/user/0/com.devrem.app/cache/belge.pdf',
    mimeType: 'application/pdf',
    originalName: 'belge.pdf',
    shareType: 'file',
    value: 'content://provider/belge',
    ...overrides,
  } as ResolvedSharePayload;
}

function write16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function write32(bytes: Uint8Array, offset: number, value: number) {
  write16(bytes, offset, value & 0xffff);
  write16(bytes, offset + 2, value >>> 16);
}

function fakeZip(entryNames: readonly string[]): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = entryNames.map((name) => encoder.encode(name));
  const centralSize = encoded.reduce((total, name) => total + 46 + name.length, 0);
  const centralOffset = 4;
  const bytes = new Uint8Array(centralOffset + centralSize + 22);
  write32(bytes, 0, 0x04034b50);
  let offset = centralOffset;
  for (const name of encoded) {
    write32(bytes, offset, 0x02014b50);
    write16(bytes, offset + 28, name.length);
    bytes.set(name, offset + 46);
    offset += 46 + name.length;
  }
  write32(bytes, offset, 0x06054b50);
  write16(bytes, offset + 8, encoded.length);
  write16(bytes, offset + 10, encoded.length);
  write32(bytes, offset + 12, centralSize);
  write32(bytes, offset + 16, centralOffset);
  return bytes;
}

test('normalizes only a trusted cache file with exact PDF metadata', () => {
  const result = normalizeInboundShareMetadata({
    actualSize: 123,
    cacheUri: 'file:///data/user/0/com.devrem.app/cache/',
    payload: payload(),
  });
  assert.equal(result.source, 'androidShare');
  assert.equal(result.destination.kind, 'canonicalDevreGroup');
  assert.equal(result.attachment.kind, 'document');
  assert.equal(result.attachment.fileName, 'belge.pdf');
});

test('rejects content URIs and paths outside the app cache', () => {
  assert.throws(() => normalizeInboundShareMetadata({ actualSize: 123, cacheUri: 'file:///cache/', payload: payload({ contentUri: 'content://provider/belge.pdf' }) }), /unsafe-share-uri/);
  assert.throws(() => normalizeInboundShareMetadata({ actualSize: 123, cacheUri: 'file:///cache/', payload: payload({ contentUri: 'file:///other/belge.pdf' }) }), /unsafe-share-uri/);
});

test('rejects unsupported MIME, mismatched extension, and oversized documents', () => {
  const base = { actualSize: 123, cacheUri: 'file:///data/user/0/com.devrem.app/cache/' };
  assert.throws(() => normalizeInboundShareMetadata({ ...base, payload: payload({ contentMimeType: 'video/mp4', mimeType: 'video/mp4', originalName: 'clip.mp4' }) }), /unsupported-share-type/);
  assert.throws(() => normalizeInboundShareMetadata({ ...base, payload: payload({ originalName: 'belge.exe' }) }), /share-type-mismatch/);
  assert.throws(() => normalizeInboundShareMetadata({ ...base, actualSize: DEVRE_CHAT_DOCUMENT_MAX_BYTES + 1, payload: payload() }), /document-too-large/);
});

test('sanitizes untrusted display names', () => {
  assert.equal(sanitizeInboundFileName('../kotu\u0000/ad.pdf'), '.._kotu__ad.pdf');
});

test('validates image magic bytes independently from declared MIME', () => {
  assert.equal(validateImageSignature('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(validateImageSignature('image/png', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), false);
  assert.equal(validateImageSignature('image/webp', Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), true);
});

test('validates PDF, legacy Office, and OOXML package identity', () => {
  assert.equal(validateDocumentSignature('pdf', new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(validateDocumentSignature('doc', Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), true);
  const docx = fakeZip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
  assert.deepEqual(readZipEntryNames(docx), new Set(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']));
  assert.equal(validateDocumentSignature('docx', docx), true);
  assert.equal(validateDocumentSignature('xlsx', docx), false);
  assert.equal(validateDocumentSignature('pptx', fakeZip(['[Content_Types].xml', '_rels/.rels', '../evil'])), false);
});

test('binds a pending share to one account and suppresses duplicate sends', () => {
  clearInboundShareSession();
  assert.equal(bindInboundShareToUser('share-1', 'uid-a'), true);
  assert.equal(bindInboundShareToUser('share-1', 'uid-b'), false);
  assert.equal(beginInboundShareSend('share-1'), true);
  assert.equal(beginInboundShareSend('share-1'), false);
  releaseInboundShareSend('share-1');
  assert.equal(beginInboundShareSend('share-1'), true);
});
