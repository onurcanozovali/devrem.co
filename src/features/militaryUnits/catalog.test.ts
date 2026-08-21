import assert from 'node:assert/strict';
import test from 'node:test';

import { getMilitaryUnitById, getMilitaryUnitsByCity, militaryUnitCatalog, resolveMilitaryUnit, searchMilitaryUnits } from './catalog';
import { getForceBranding } from './forceBranding';

test('canonical catalog loads unique units and preserves verified coordinates', () => {
  assert.equal(militaryUnitCatalog.length, 48);
  assert.equal(new Set(militaryUnitCatalog.map(({ id }) => id)).size, 48);
  const unit = getMilitaryUnitById('air-43-hava-er-egitim-tugay-komutanligi');
  assert.deepEqual(unit?.coordinates, { lat: 39.416536, lng: 30.017861 });
  assert.deepEqual(unit?.mapCoordinates, unit?.coordinates);
  assert.equal(unit?.publicAddressDisplayValue, 'Hava Er Eğitim Tugayı, Merkez, Kütahya');
  assert.equal(unit?.transportationDisplayValue, "Kütahya Otogarı'na (Çinigar) yürüme mesafesinde veya çok kısa taksi/minibüs mesafesindedir.");
  assert.equal(unit?.mapSearchQuery, 'Hava Er Eğitim Tugay Komutanlığı, Kütahya');
  assert.equal(unit?.mapCanOpenDirections, true);
  assert.equal(unit?.facilities.find((facility) => facility.code === 'canteen')?.displayClaim, 'Büyük Alışveriş/Kantin Kompleksi');
  assert.equal(unit?.verificationSources.length, 2);
});

test('city selection and alias search use canonical records', () => {
  assert.equal(getMilitaryUnitsByCity(43).length, 1);
  assert.equal(searchMilitaryUnits(43, 'Hava Er Eğitim Tugayı')[0]?.id, 'air-43-hava-er-egitim-tugay-komutanligi');
  assert.equal(resolveMilitaryUnit(43, 'Hava Er Eğitim Tugay').status, 'resolved');
  assert.equal(resolveMilitaryUnit(6, 'Hava Er Eğitim Tugay').status, 'unresolved');
});

test('force branding is centralized and missing logos stay null', () => {
  assert.match(getForceBranding('air')?.logoUrl ?? '', /^https:\/\/firebasestorage\.googleapis\.com\//);
  assert.equal(getForceBranding('coast_guard')?.logoUrl, null);
});
