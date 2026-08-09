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
  militaryUnitName: '1. Piyade Tugayı',
});

test('discovery seed creates exactly the requested deterministic scenario groups', () => {
  assert.equal(profiles.length, 12);
  assert.deepEqual(
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((group) => [
      group,
      profiles.filter((profile) => profile.group === group).length,
    ])),
    { A: 3, B: 2, C: 2, D: 2, E: 1, F: 1, G: 1 },
  );
  assert.equal(new Set(profiles.map(({ id }) => id)).size, 12);
  assert.equal(profiles.filter(({ hasAvatar }) => hasAvatar).length, 4);
});

test('excluded and edge-case seed groups remain fake and outside private schema', () => {
  const differentCitySameUnit = profiles.find(({ group }) => group === 'E');
  const excludedPeriod = profiles.find(({ group }) => group === 'F');
  const edgeCase = profiles.find(({ group }) => group === 'G');
  assert.notEqual(differentCitySameUnit?.profile.militaryCity, 43);
  assert.equal(differentCitySameUnit?.profile.militaryUnitName, '1. Piyade Tugayı');
  assert.notDeepEqual(
    [excludedPeriod?.profile.militaryPeriodYear, excludedPeriod?.profile.militaryPeriodMonth],
    [2027, 2],
  );
  assert.equal(edgeCase?.id, 'devrem-discovery-seed-g1');
  assert.equal(edgeCase?.profile.militaryType, 'paid');
  assert.ok(profiles.every(({ id }) => id.startsWith('devrem-discovery-seed-')));
  assert.ok(profiles.every(({ profile }) => !('birthYear' in profile)));
});

test('seed scenarios reserve devre membership for the same period and unit', () => {
  const sameUnit = ({ profile }: (typeof profiles)[number]) => (
    profile.militaryPeriodYear === 2027
    && profile.militaryPeriodMonth === 2
    && profile.militaryUnitName?.toLocaleLowerCase('tr-TR') === '1. piyade tugayı'
  );
  assert.deepEqual(profiles.filter(sameUnit).map(({ group }) => group), ['A', 'A', 'A', 'C', 'C', 'E', 'G']);
  assert.ok(profiles.filter(({ group }) => group === 'B').every(({ profile }) => (
    profile.militaryCity === 43 && profile.militaryUnitName !== '1. Piyade Tugayı'
  )));
  assert.ok(profiles.filter(({ group }) => group === 'D').every(({ profile }) => profile.militaryUnitName === null));
  assert.ok(profiles.filter(({ group }) => group === 'A').every(({ profile }) => profile.departureCity === 6));
  assert.ok(profiles.filter(({ group }) => group === 'C').every(({ profile }) => profile.residenceCity === 34));
});