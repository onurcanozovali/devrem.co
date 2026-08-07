import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { turkeyProvinces, type ProvinceCode } from '@/data/turkeyProvinces';
import { useProfile } from '@/features/profile/hooks/useProfile';
import {
  createMilitaryYearOptions,
  militaryMonthOptions,
  militaryTypeOptions,
} from '@/features/profile/profileOptions';
import { ProfileFlowError, mapProfileError } from '@/features/profile/services/profileErrors';
import {
  formatReportingDateInput,
  isValidBirthYear,
  isValidMilitaryUnit,
  isValidName,
  normalizeWhitespace,
  parseReportingDateInput,
  profileFieldLimits,
} from '@/features/profile/services/profileValidation';
import type { CompleteUserProfileInput, MilitaryType } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';

const steps = [
  { title: 'Kişisel Bilgiler', description: 'Sana hitap edebilmemiz için temel bilgilerini ekle.' },
  { title: 'Nereden Gidiyorsun?', description: 'Yolculuk başlangıcını şehir kodlarıyla güvenli biçimde kaydedelim.' },
  { title: 'Askerlik Bilgileri', description: 'Celp dönemini ve görev yerini belirle.' },
  { title: 'Birlik ve Teslim', description: 'Son olarak birlik ve teslim tarihi bilgilerini tamamla.' },
] as const;

const provinceOptions = turkeyProvinces.map(({ code, name }) => ({ value: code, label: name }));

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'birthYear'
  | 'residenceCity'
  | 'departureCity'
  | 'militaryType'
  | 'militaryYear'
  | 'militaryMonth'
  | 'militaryCity'
  | 'militaryUnit'
  | 'reportingDate';

type FormErrors = Partial<Record<FieldName, string>>;

export function OnboardingScreen() {
  const { completeOnboarding } = useProfile();
  const { colors, radii, spacing } = useTheme();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [residenceCity, setResidenceCity] = useState<ProvinceCode | null>(null);
  const [departureCity, setDepartureCity] = useState<ProvinceCode | null>(null);
  const [militaryType, setMilitaryType] = useState<MilitaryType | null>(null);
  const [militaryYear, setMilitaryYear] = useState<number | null>(null);
  const [militaryMonth, setMilitaryMonth] = useState<number | null>(null);
  const [militaryCity, setMilitaryCity] = useState<ProvinceCode | null>(null);
  const [militaryUnit, setMilitaryUnit] = useState('');
  const [reportingDate, setReportingDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const yearOptions = useMemo(() => createMilitaryYearOptions(), []);
  const currentStep = steps[step] ?? steps[0];

  const clearError = (field: FieldName) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (submissionError) setSubmissionError(null);
  };

  const validateStep = (): boolean => {
    const nextErrors: FormErrors = {};

    if (step === 0) {
      if (!isValidName(firstName)) nextErrors.firstName = `Ad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
      if (!isValidName(lastName)) nextErrors.lastName = `Soyad ${profileFieldLimits.nameMin}-${profileFieldLimits.nameMax} karakter olmalı.`;
      if (!isValidBirthYear(Number(birthYear))) nextErrors.birthYear = 'Geçerli bir doğum yılı girin.';
    }

    if (step === 1) {
      if (!residenceCity) nextErrors.residenceCity = 'Yaşadığınız şehri seçin.';
      if (!departureCity) nextErrors.departureCity = 'Yola çıkacağınız şehri seçin.';
    }

    if (step === 2) {
      if (!militaryType) nextErrors.militaryType = 'Askerlik türünü seçin.';
      if (!militaryYear) nextErrors.militaryYear = 'Celp yılını seçin.';
      if (!militaryMonth) nextErrors.militaryMonth = 'Celp ayını seçin.';
      if (!militaryCity) nextErrors.militaryCity = 'Gideceğiniz şehri seçin.';
    }

    if (step === 3) {
      if (!isValidMilitaryUnit(militaryUnit)) nextErrors.militaryUnit = `Birlik ${profileFieldLimits.militaryUnitMin}-${profileFieldLimits.militaryUnitMax} karakter olmalı.`;
      if (!parseReportingDateInput(reportingDate)) nextErrors.reportingDate = 'Teslim tarihini GG.AA.YYYY biçiminde girin.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildProfileInput = (): CompleteUserProfileInput | null => {
    const storedReportingDate = parseReportingDateInput(reportingDate);
    if (
      !isValidName(firstName)
      || !isValidName(lastName)
      || !isValidBirthYear(Number(birthYear))
      || residenceCity === null
      || departureCity === null
      || militaryType === null
      || militaryYear === null
      || militaryMonth === null
      || militaryCity === null
      || !isValidMilitaryUnit(militaryUnit)
      || storedReportingDate === null
    ) return null;

    return {
      firstName: normalizeWhitespace(firstName),
      lastName: normalizeWhitespace(lastName),
      birthYear: Number(birthYear),
      residenceCity,
      departureCity,
      militaryType,
      militaryPeriod: { year: militaryYear, month: militaryMonth },
      militaryCity,
      militaryUnit: normalizeWhitespace(militaryUnit),
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
      setSubmissionError('Bazı bilgiler eksik veya geçersiz. Önceki adımları kontrol edin.');
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

  return (
    <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
      <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surfaceSubtle, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
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

        <View style={{ gap: spacing.sm }}>
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
              placeholder="2000"
              keyboardType="number-pad"
              maxLength={4}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <SelectField
              label="Yaşadığın şehir"
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
              label="Yola çıkacağın şehir"
              placeholder="Şehir seç"
              value={departureCity}
              options={provinceOptions}
              onValueChange={(value) => { setDepartureCity(value); clearError('departureCity'); }}
              error={errors.departureCity}
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
                  onValueChange={(value) => { setMilitaryYear(value); clearError('militaryYear'); }}
                  error={errors.militaryYear}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField
                  label="Celp ayı"
                  placeholder="Ay"
                  value={militaryMonth}
                  options={militaryMonthOptions}
                  onValueChange={(value) => { setMilitaryMonth(value); clearError('militaryMonth'); }}
                  error={errors.militaryMonth}
                />
              </View>
            </View>
            <SelectField
              label="Gideceğin şehir"
              placeholder="Şehir seç"
              value={militaryCity}
              options={provinceOptions}
              onValueChange={(value) => { setMilitaryCity(value); clearError('militaryCity'); }}
              error={errors.militaryCity}
              searchPlaceholder="İl ara"
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <TextField
              label="Birlik"
              value={militaryUnit}
              onChangeText={(value) => { setMilitaryUnit(value); clearError('militaryUnit'); }}
              error={errors.militaryUnit}
              placeholder="Örn. 5. Piyade Eğitim Tugayı"
              autoCapitalize="sentences"
              maxLength={profileFieldLimits.militaryUnitMax}
            />
            <AppText color="muted" variant="caption">
              Birlik alanı bu fazda elle girilir; resmî birlik veritabanı eklendiğinde kontrollü kimliklere geçirilecektir.
            </AppText>
            <TextField
              label="Teslim tarihi"
              value={reportingDate}
              onChangeText={(value) => { setReportingDate(formatReportingDateInput(value)); clearError('reportingDate'); }}
              error={errors.reportingDate}
              placeholder="GG.AA.YYYY"
              keyboardType="number-pad"
              maxLength={10}
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
