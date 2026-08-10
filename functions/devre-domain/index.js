const militaryTypes = new Set(['standard', 'paid', 'reserveOfficer', 'reserveNco']);

function normalizeDevreWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function getDevreIdentityKey(profile) {
  if (
    !profile
    || !Number.isInteger(profile.militaryPeriodYear)
    || !Number.isInteger(profile.militaryPeriodMonth)
    || !Number.isInteger(profile.militaryCity)
    || !militaryTypes.has(profile.militaryType)
  ) return null;
  const unitId = typeof profile.militaryUnitId === 'string'
    ? normalizeDevreWhitespace(profile.militaryUnitId)
    : '';
  const unitName = typeof profile.militaryUnitName === 'string'
    ? normalizeDevreWhitespace(profile.militaryUnitName).toLocaleLowerCase('tr-TR')
    : '';
  const unitIdentity = unitId ? `id:${unitId}` : unitName ? `name:${unitName}` : null;
  if (!unitIdentity) return null;
  return JSON.stringify([
    1,
    profile.militaryPeriodYear,
    profile.militaryPeriodMonth,
    profile.militaryCity,
    profile.militaryType,
    unitIdentity,
  ]);
}

function hasExactDevreIdentity(reference, candidate) {
  const referenceKey = getDevreIdentityKey(reference);
  return referenceKey !== null && referenceKey === getDevreIdentityKey(candidate);
}

module.exports = { getDevreIdentityKey, hasExactDevreIdentity, normalizeDevreWhitespace };
