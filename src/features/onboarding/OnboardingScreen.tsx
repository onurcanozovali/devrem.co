import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { ProvinceCode } from '@/data/turkeyProvinces';
import { getMilitaryUnitById, getMilitaryUnitsByCity } from '@/features/militaryUnits/catalog';
import { useProfile } from '@/features/profile/hooks/useProfile';
import {
  createMilitaryMonthOptions,
  createMilitaryYearOptions,
  militaryTypeOptions,
  provinceOptions,
} from '@/features/profile/profileOptions';
import { ProfileFlowError, mapProfileError } from '@/features/profile/services/profileErrors';
import {
  formatStoredDate,
  getMinimumReportingDate,
  isMilitaryPeriodCurrentOrFuture,
  isReportingDateConsistent,
  isValidBirthYear,
  isValidMilitaryUnit,
  isValidName,
  localDateToStoredDate,
  normalizeWhitespace,
  profileFieldLimits,
  startOfLocalDay,
} from '@/features/profile/services/profileValidation';
import type { CompleteUserProfileInput, MilitaryType } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';

const steps = [
  { title: 'Kişisel Bilgiler', description: 'Seni tanımamız için birkaç temel bilgi.' },
  { title: 'Nereye Gidiyorsun?', description: 'Yolculuğunun başlangıç ve varış şehirlerini seç.' },
  { title: 'Askerlik Bilgileri', description: 'Askerlik türünü ve yaklaşan celp dönemini belirt.' },
  { title: 'Birlik ve Teslim', description: 'Bildiğin birlik bilgisini ve teslim tarihini ekle.' },
] as const;

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'birthYear'
  | 'residenceCity'
  | 'departureCity'
  | 'militaryCity'
  | 'militaryType'
  | 'militaryYear'
  | 'militaryMonth'
  | 'militaryUnit'
  | 'reportingDate';

type FormErrors = Partial<Record<FieldName, string>>;

export function OnboardingScreen() {
  const { completeOnboarding } = useProfile();
  const { colors, radii, spacing } = useTheme();
  const [referenceDate] = useState(() => new Date());
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [residenceCity, setResidenceCity] = useState<ProvinceCode | null>(null);
  const [departureCity, setDepartureCity] = useState<ProvinceCode | null>(null);
  const [militaryCity, setMilitaryCity] = useState<ProvinceCode | null>(null);
  const [militaryType, setMilitaryType] = useState<MilitaryType | null>(null);
  const [militaryYear, setMilitaryYear] = useState<number | null>(null);
  const [militaryMonth, setMilitaryMonth] = useState<number | null>(null);
  const [knowsMilitaryUnit, setKnowsMilitaryUnit] = useState(false);
  const [usesUnresolvedMilitaryUnit, setUsesUnresolvedMilitaryUnit] = useState(false);
  const [militaryUnitId, setMilitaryUnitId] = useState<string | null>(null);
  const [militaryUnit, setMilitaryUnit] = useState('');
  const [reportingDate, setReportingDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const yearOptions = useMemo(() => createMilitaryYearOptions(referenceDate), [referenceDate]);
  const monthOptions = useMemo(
    () => createMilitaryMonthOptions(militaryYear, referenceDate),
    [militaryYear, referenceDate],
  );
  const militaryUnitOptions = useMemo(() => getMilitaryUnitsByCity(militaryCity).map((unit) => ({
    value: unit.id,
    label: unit.name,
    searchText: [unit.shortName ?? '', ...unit.aliases].join(' '),
  })), [militaryCity]);
  const minimumReportingDate = useMemo(
    () => militaryYear !== null && militaryMonth !== null
      ? getMinimumReportingDate(militaryYear, militaryMonth, referenceDate)
      : startOfLocalDay(referenceDate),
    [militaryMonth, militaryYear, referenceDate],
  );
  const currentStep = steps[step] ?? steps[0];

  const clearError = (field: FieldName) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (submissionError) setSubmissionError(null);
  };

  const keepReportingDateIfConsistent = (year: number | null, month: number | null) => {
    if (!reportingDate) return;
    if (year === null || month === null) {
      setReportingDate(null);
      return;
    }
    if (!isReportingDateConsistent(localDateToStoredDate(reportingDate), year, month, referenceDate)) {
      setReportingDate(null);
    }
  };

  const handleMilitaryYearChange = (year: number) => {
    const nextMonth = militaryMonth !== null
      && isMilitaryPeriodCurrentOrFuture(year, militaryMonth, referenceDate)
      ? militaryMonth
      : null;
    setMilitaryYear(year);
    setMilitaryMonth(nextMonth);
    keepReportingDateIfConsistent(year, nextMonth);
    clearError('militaryYear');
    if (nextMonth === null) clearError('militaryMonth');
  };

  const handleMilitaryMonthChange = (month: number) => {
    setMilitaryMonth(month);
    keepReportingDateIfConsistent(militaryYear, month);
    clearError('militaryMonth');
  };

  const validateStep = (): boolean => {
    const nextErrors: FormErrors = {};

    if (step === 0) {
      if (!isValidName(firstName)) nextErrors.firstName = `Ad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
      if (!isValidName(lastName)) nextErrors.lastName = `Soyad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
      if (!isValidBirthYear(Number(birthYear), referenceDate.getFullYear())) {
        nextErrors.birthYear = `${referenceDate.getFullYear() - 100}-${referenceDate.getFullYear() - 18} arasında bir yıl gir.`;
      }
    }

    if (step === 1) {
      if (!residenceCity) nextErrors.residenceCity = 'Yaşadığın şehri seç.';
      if (!departureCity) nextErrors.departureCity = 'Yola çıkacağın şehri seç.';
      if (!militaryCity) nextErrors.militaryCity = 'Gideceğin şehri seç.';
    }

    if (step === 2) {
      if (!militaryType) nextErrors.militaryType = 'Askerlik türünü seç.';
      if (!militaryYear) nextErrors.militaryYear = 'Celp yılını seç.';
      if (!militaryMonth) nextErrors.militaryMonth = 'Celp ayını seç.';
      if (
        militaryYear !== null
        && militaryMonth !== null
        && !isMilitaryPeriodCurrentOrFuture(militaryYear, militaryMonth, referenceDate)
      ) nextErrors.militaryMonth = 'Geçmiş bir celp dönemi seçilemez.';
    }

    if (step === 3) {
      if (knowsMilitaryUnit && !usesUnresolvedMilitaryUnit && !getMilitaryUnitById(militaryUnitId)) {
        nextErrors.militaryUnit = 'Birliğini listeden seç.';
      } else if (knowsMilitaryUnit && usesUnresolvedMilitaryUnit && !isValidMilitaryUnit(militaryUnit)) {
        nextErrors.militaryUnit = `Birlik adı ${profileFieldLimits.militaryUnitMin}-${profileFieldLimits.militaryUnitMax} karakter olmalı.`;
      }
      const storedReportingDate = reportingDate ? localDateToStoredDate(reportingDate) : null;
      if (
        !storedReportingDate
        || militaryYear === null
        || militaryMonth === null
        || !isReportingDateConsistent(
          storedReportingDate,
          militaryYear,
          militaryMonth,
          referenceDate,
        )
      ) nextErrors.reportingDate = 'Bugünden ve seçtiğin celp döneminden önce olmayan bir tarih seç.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildProfileInput = (): CompleteUserProfileInput | null => {
    const storedReportingDate = reportingDate ? localDateToStoredDate(reportingDate) : null;
    const selectedUnit = !usesUnresolvedMilitaryUnit ? getMilitaryUnitById(militaryUnitId) : null;
    const normalizedUnit = knowsMilitaryUnit ? selectedUnit?.name ?? normalizeWhitespace(militaryUnit) : null;
    if (
      !isValidName(firstName)
      || !isValidName(lastName)
      || !isValidBirthYear(Number(birthYear), referenceDate.getFullYear())
      || residenceCity === null
      || departureCity === null
      || militaryCity === null
      || militaryType === null
      || militaryYear === null
      || militaryMonth === null
      || !isMilitaryPeriodCurrentOrFuture(militaryYear, militaryMonth, referenceDate)
      || (knowsMilitaryUnit && !selectedUnit && !isValidMilitaryUnit(normalizedUnit))
      || (selectedUnit && selectedUnit.cityCode !== militaryCity)
      || storedReportingDate === null
      || !isReportingDateConsistent(
        storedReportingDate,
        militaryYear,
        militaryMonth,
        referenceDate,
      )
    ) return null;

    return {
      firstName: normalizeWhitespace(firstName),
      lastName: normalizeWhitespace(lastName),
      birthYear: Number(birthYear),
      residenceCity,
      departureCity,
      militaryCity,
      militaryType,
      militaryPeriodYear: militaryYear,
      militaryPeriodMonth: militaryMonth,
      militaryUnit: normalizedUnit,
      militaryUnitId: selectedUnit?.id ?? null,
      militaryUnitNameSnapshot: normalizedUnit,
      forceCode: selectedUnit?.forceCode ?? null,
      reportingDate: storedReportingDate,
    };
  };

  const handleContinue = async () => {
    if (isSubmitting || !validateStep()) return;
    setSubmissionError(null);

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const input = buildProfileInput();
    if (!input) {
      setSubmissionError('Bazı bilgiler eksik veya geçersiz. Önceki adımları kontrol et.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding(input);
    } catch (caughtError: unknown) {
      const profileError = caughtError instanceof ProfileFlowError ? caughtError : mapProfileError(caughtError);
      setSubmissionError(profileError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUnitChoice = (known: boolean, label: string) => {
    const selected = knowsMilitaryUnit === known;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => {
          setKnowsMilitaryUnit(known);
          if (!known) {
            setUsesUnresolvedMilitaryUnit(false);
            setMilitaryUnitId(null);
            setMilitaryUnit('');
          }
          clearError('militaryUnit');
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: selected ? colors.primarySubtle : pressed ? colors.surfaceSecondary : colors.inputBackground,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          minHeight: 54,
          paddingHorizontal: spacing.md,
        })}
      >
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={selected ? colors.primary : colors.textMuted}
        />
        <AppText weight={selected ? '700' : '500'} style={{ flex: 1 }}>{label}</AppText>
      </Pressable>
    );
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
      <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.primarySubtle, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <AppText weight="800" style={{ color: colors.primary }}>DEVREM</AppText>
          </View>
          <AppText color="muted" variant="caption">Adım {step + 1} / {steps.length}</AppText>
        </View>

        <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {steps.map((item, index) => (
            <View
              key={item.title}
              style={{
                backgroundColor: index <= step ? colors.primary : colors.border,
                borderRadius: radii.pill,
                flex: 1,
                height: 5,
              }}
            />
          ))}
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" weight="800">{currentStep.title}</AppText>
          <AppText color="muted">{currentStep.description}</AppText>
        </View>
      </View>

      <Card style={{ gap: spacing.lg }}>
        {step === 0 ? (
          <>
            <TextField
              label="Ad"
              value={firstName}
              onChangeText={(value) => { setFirstName(value); clearError('firstName'); }}
              error={errors.firstName}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={profileFieldLimits.nameMax}
              returnKeyType="next"
            />
            <TextField
              label="Soyad"
              value={lastName}
              onChangeText={(value) => { setLastName(value); clearError('lastName'); }}
              error={errors.lastName}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              maxLength={profileFieldLimits.nameMax}
              returnKeyType="next"
            />
            <TextField
              label="Doğum yılı"
              value={birthYear}
              onChangeText={(value) => { setBirthYear(value.replace(/\D/g, '').slice(0, 4)); clearError('birthYear'); }}
              error={errors.birthYear}
              placeholder={String(referenceDate.getFullYear() - 24)}
              keyboardType="number-pad"
              maxLength={4}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <SelectField
              label="Yaşadığın Şehir"
              placeholder="Şehir seç"
              value={residenceCity}
              options={provinceOptions}
              onValueChange={(value) => {
                setResidenceCity(value);
                setDepartureCity((current) => current ?? value);
                clearError('residenceCity');
              }}
              error={errors.residenceCity}
              searchPlaceholder="İl ara"
            />
            <SelectField
              label="Yola Çıkacağın Şehir"
              placeholder="Şehir seç"
              value={departureCity}
              options={provinceOptions}
              onValueChange={(value) => { setDepartureCity(value); clearError('departureCity'); }}
              error={errors.departureCity}
              searchPlaceholder="İl ara"
            />
            <SelectField
              label="Gideceğin Şehir"
              placeholder="Şehir seç"
              value={militaryCity}
              options={provinceOptions}
              onValueChange={(value) => {
                setMilitaryCity(value);
                setMilitaryUnitId(null);
                setMilitaryUnit('');
                clearError('militaryCity');
                clearError('militaryUnit');
              }}
              error={errors.militaryCity}
              searchPlaceholder="İl ara"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <SelectField
              label="Askerlik türü"
              placeholder="Tür seç"
              value={militaryType}
              options={militaryTypeOptions}
              onValueChange={(value) => { setMilitaryType(value); clearError('militaryType'); }}
              error={errors.militaryType}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <SelectField
                  label="Celp yılı"
                  placeholder="Yıl"
                  value={militaryYear}
                  options={yearOptions}
                  onValueChange={handleMilitaryYearChange}
                  error={errors.militaryYear}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField
                  label="Celp ayı"
                  placeholder={militaryYear === null ? 'Önce yıl' : 'Ay'}
                  value={militaryMonth}
                  options={monthOptions}
                  onValueChange={handleMilitaryMonthChange}
                  error={errors.militaryMonth}
                  disabled={militaryYear === null}
                />
              </View>
            </View>
            <AppText color="muted" variant="caption">
              Yalnızca içinde bulunduğun ay ve sonraki celp dönemleri gösterilir.
            </AppText>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <AppText weight="600">Birlik bilgin var mı?</AppText>
              <View style={{ gap: spacing.sm }}>
                {renderUnitChoice(false, 'Birliğimi henüz bilmiyorum')}
                {renderUnitChoice(true, 'Birliğimi biliyorum')}
              </View>
            </View>

            {knowsMilitaryUnit ? (
              <View style={{ gap: spacing.md }}>
                {!usesUnresolvedMilitaryUnit ? <SelectField
                  label="Askerî birlik"
                  value={militaryUnitId}
                  options={militaryUnitOptions}
                  onValueChange={(value) => {
                    const unit = getMilitaryUnitById(value);
                    setMilitaryUnitId(value);
                    setMilitaryUnit(unit?.name ?? '');
                    clearError('militaryUnit');
                  }}
                  error={errors.militaryUnit}
                  placeholder={militaryCity ? 'Birlik seç' : 'Önce görev şehrini seç'}
                  searchPlaceholder="Birlik veya bilinen adını ara"
                  disabled={!militaryCity}
                /> : <TextField
                  label="Birlik adı"
                  value={militaryUnit}
                  onChangeText={(value) => { setMilitaryUnit(value); clearError('militaryUnit'); }}
                  error={errors.militaryUnit}
                  placeholder="Birlik adını yaz"
                  autoCapitalize="sentences"
                  maxLength={profileFieldLimits.militaryUnitMax}
                />}
                <Pressable accessibilityRole="button" onPress={() => {
                  setUsesUnresolvedMilitaryUnit((current) => !current);
                  setMilitaryUnitId(null);
                  setMilitaryUnit('');
                  clearError('militaryUnit');
                }} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <AppText style={{ color: colors.primary }} weight="700">{usesUnresolvedMilitaryUnit ? 'Listeden birlik seç' : 'Birliğimi bulamıyorum'}</AppText>
                </Pressable>
                {militaryCity && militaryUnitOptions.length === 0 && !usesUnresolvedMilitaryUnit ? <AppText color="muted" variant="caption">Bu şehir için doğrulanmış katalog kaydı bulunamadı. “Birliğimi bulamıyorum” seçeneğini kullanabilirsin.</AppText> : null}
              </View>
            ) : (
              <AppText color="muted" variant="caption">
                Sorun değil; birlik bilgini daha sonra ekleyebilirsin.
              </AppText>
            )}

            <DatePickerField
              label="Teslim tarihi"
              value={reportingDate}
              minimumDate={minimumReportingDate}
              onValueChange={(value) => {
                setReportingDate(value);
                clearError('reportingDate');
              }}
              error={errors.reportingDate}
              hint={`Seçilebilecek en erken tarih: ${formatStoredDate(localDateToStoredDate(minimumReportingDate))}`}
            />
          </>
        ) : null}
      </Card>

      {submissionError ? (
        <AppText color="danger" variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
          {submissionError}
        </AppText>
      ) : null}

      <View style={{ flexDirection: step === 0 ? 'column' : 'row', gap: spacing.md }}>
        {step > 0 ? (
          <Button
            label="Geri"
            variant="secondary"
            disabled={isSubmitting}
            onPress={() => {
              setErrors({});
              setSubmissionError(null);
              setStep((current) => Math.max(0, current - 1));
            }}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label={step === steps.length - 1 ? 'Tamamla' : 'Devam et'}
          loading={isSubmitting}
          onPress={() => void handleContinue()}
          style={{ flex: 1 }}
        />
      </View>
    </ScreenContainer>
  );
}
