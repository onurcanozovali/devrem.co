/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDiscoverySeedProfiles } from '../src/discoverySeed';

const profiles = buildDiscoverySeedProfiles({
  residenceCity: 34,
  departureCity: 6,
  militaryCity: 43,
  militaryPeriodYear: 2027,
  militaryPeriodMonth: 2,
  militaryType: 'standard',
  militaryUnitName: '1. Piyade Tugayı',
});

test('discovery seed creates exactly the requested deterministic scenario groups', () => {
  assert.equal(profiles.length, 12);
  assert.deepEqual(
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((group) => [
      group,
      profiles.filter((profile) => profile.group === group).length,
    ])),
    { A: 2, B: 1, C: 2, D: 1, E: 1, F: 2, G: 2, H: 1 },
  );
  assert.equal(new Set(profiles.map(({ id }) => id)).size, 12);
  assert.equal(profiles.filter(({ hasAvatar }) => hasAvatar).length, 4);
});

test('excluded and edge-case seed groups remain fake and outside private schema', () => {
  const differentType = profiles.find(({ group }) => group === 'B');
  const differentCitySameUnit = profiles.find(({ group }) => group === 'D');
  const excludedPeriod = profiles.find(({ group }) => group === 'E');
  const missingType = profiles.find(({ group }) => group === 'H');
  assert.equal(differentType?.profile.militaryType, 'paid');
  assert.notEqual(differentCitySameUnit?.profile.militaryCity, 43);
  assert.equal(differentCitySameUnit?.profile.militaryUnitName, '1. Piyade Tugayı');
  assert.notDeepEqual(
    [excludedPeriod?.profile.militaryPeriodYear, excludedPeriod?.profile.militaryPeriodMonth],
    [2027, 2],
  );
  assert.equal(missingType?.id, 'devrem-discovery-seed-h1');
  assert.equal(missingType?.profile.militaryType, null);
  assert.ok(profiles.every(({ id }) => id.startsWith('devrem-discovery-seed-')));
  assert.ok(profiles.every(({ profile }) => !('birthYear' in profile)));
});

test('seed scenarios reserve devre membership for the same period, city, unit, and type', () => {
  const isExactDevre = ({ profile }: (typeof profiles)[number]) => (
    profile.militaryPeriodYear === 2027
    && profile.militaryPeriodMonth === 2
    && profile.militaryCity === 43
    && profile.militaryType === 'standard'
    && profile.militaryUnitName?.toLocaleLowerCase('tr-TR') === '1. piyade tugayı'
  );
  assert.deepEqual(profiles.filter(isExactDevre).map(({ group }) => group), ['A', 'A', 'F', 'F', 'G', 'G']);
  assert.ok(profiles.filter(({ group }) => group === 'C').every(({ profile }) => (
    profile.militaryCity === 43 && profile.militaryUnitName !== '1. Piyade Tugayı'
  )));
  assert.ok(profiles.filter(({ group }) => group === 'F').every(({ profile }) => profile.departureCity === 6));
  assert.ok(profiles.filter(({ group }) => group === 'G').every(({ profile }) => profile.residenceCity === 34));
});