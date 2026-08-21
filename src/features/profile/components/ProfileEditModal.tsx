import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { DevremConfirmModal } from '@/components/ui/DevremConfirmModal';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { getMilitaryUnitById, getMilitaryUnitsByCity } from '@/features/militaryUnits/catalog';
import {
  createMilitaryMonthOptions,
  createMilitaryYearOptions,
  militaryTypeOptions,
  provinceOptions,
} from '@/features/profile/profileOptions';
import { ProfileFlowError, mapProfileError } from '@/features/profile/services/profileErrors';
import {
  createProfileFormValues,
  isProfileFormDirty,
  type ProfileFormErrors,
  type ProfileFormField,
  type ProfileFormValues,
  validateProfileForm,
} from '@/features/profile/services/profileForm';
import {
  getMinimumReportingDate,
  isMilitaryPeriodCurrentOrFuture,
  profileFieldLimits,
  startOfLocalDay,
  storedDateToLocalDate,
} from '@/features/profile/services/profileValidation';
import type { CompleteUserProfileInput, UserProfile } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';

interface ProfileEditModalProps {
  profile: UserProfile;
  visible: boolean;
  onClose: () => void;
  onSave: (input: CompleteUserProfileInput) => Promise<void>;
}

export function ProfileEditModal({ profile, visible, onClose, onSave }: ProfileEditModalProps) {
  const { colors, radii, spacing } = useTheme();
  const [referenceDate] = useState(() => new Date());
  const [values, setValues] = useState<ProfileFormValues>(() => createProfileFormValues(profile));
  const [usesUnresolvedMilitaryUnit, setUsesUnresolvedMilitaryUnit] = useState(() => Boolean(profile.militaryUnit && !profile.militaryUnitId));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const storedPeriod = useMemo(() => ({
    year: profile.militaryPeriodYear,
    month: profile.militaryPeriodMonth,
  }), [profile.militaryPeriodMonth, profile.militaryPeriodYear]);
  const yearOptions = useMemo(
    () => createMilitaryYearOptions(referenceDate, profile.militaryPeriodYear),
    [profile.militaryPeriodYear, referenceDate],
  );
  const monthOptions = useMemo(
    () => createMilitaryMonthOptions(values.militaryYear, referenceDate, storedPeriod),
    [referenceDate, storedPeriod, values.militaryYear],
  );
  const militaryUnitOptions = useMemo(() => getMilitaryUnitsByCity(values.militaryCity).map((unit) => ({
    value: unit.id,
    label: unit.name,
    searchText: [unit.shortName ?? '', ...unit.aliases].join(' '),
  })), [values.militaryCity]);
  const periodChanged = values.militaryYear !== profile.militaryPeriodYear
    || values.militaryMonth !== profile.militaryPeriodMonth;
  const existingPeriodIsCurrentOrFuture = isMilitaryPeriodCurrentOrFuture(
    profile.militaryPeriodYear,
    profile.militaryPeriodMonth,
    referenceDate,
  );
  const minimumReportingDate = values.militaryYear !== null && values.militaryMonth !== null
    ? periodChanged || existingPeriodIsCurrentOrFuture
      ? getMinimumReportingDate(values.militaryYear, values.militaryMonth, referenceDate)
      : new Date(values.militaryYear, values.militaryMonth - 1, 1)
    : startOfLocalDay(referenceDate);
  const reportingDate = values.reportingDate ? storedDateToLocalDate(values.reportingDate) : null;
  const dirty = isProfileFormDirty(values, profile);

  const setField = <Key extends keyof ProfileFormValues>(field: Key, value: ProfileFormValues[Key]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmissionError(null);
  };

  const clearError = (field: ProfileFormField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmissionError(null);
  };

  const requestClose = () => {
    if (isSubmitting) return;
    if (!dirty) {
      onClose();
      return;
    }
    setDiscardConfirmOpen(true);
  };

  const handleSave = async () => {
    if (isSubmitting || !dirty) return;
    const result = validateProfileForm(values, {
      mode: 'edit',
      existingProfile: profile,
      referenceDate,
    });
    setErrors(result.errors);
    if (!result.input) {
      setSubmissionError('Bazı bilgiler eksik veya geçersiz. İşaretli alanları kontrol et.');
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      await onSave(result.input);
      onClose();
    } catch (caughtError: unknown) {
      const profileError = caughtError instanceof ProfileFlowError ? caughtError : mapProfileError(caughtError);
      setSubmissionError(profileError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUnitChoice = (known: boolean, label: string) => {
    const selected = values.knowsMilitaryUnit === known;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => {
          setField('knowsMilitaryUnit', known);
          if (!known) {
            setUsesUnresolvedMilitaryUnit(false);
            setValues((current) => ({ ...current, forceCode: null, militaryUnit: '', militaryUnitId: null }));
          }
          clearError('militaryUnit');
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: selected ? colors.primarySubtle : pressed ? colors.surfaceSecondary : colors.inputBackground,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radii.md,
          borderWidth: 1,
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
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profil düzenlemeyi kapat"
            hitSlop={12}
            onPress={requestClose}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}
          >
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="800">Profili düzenle</AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profil değişikliklerini kaydet"
            accessibilityState={{ disabled: !dirty || isSubmitting, busy: isSubmitting }}
            disabled={!dirty || isSubmitting}
            hitSlop={12}
            onPress={() => void handleSave()}
            style={{ justifyContent: 'center', minHeight: 44, opacity: !dirty || isSubmitting ? 0.45 : 1 }}
          >
            <AppText weight="700" style={{ color: colors.primary }}>Kaydet</AppText>
          </Pressable>
        </View>

        <View style={{ gap: spacing.lg }}>
          <AppText variant="subtitle" weight="800">Kişisel bilgiler</AppText>
          <TextField
            label="Ad"
            value={values.firstName}
            onChangeText={(value) => setField('firstName', value)}
            error={errors.firstName}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={profileFieldLimits.nameMax}
          />
          <TextField
            label="Soyad"
            value={values.lastName}
            onChangeText={(value) => setField('lastName', value)}
            error={errors.lastName}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            maxLength={profileFieldLimits.nameMax}
          />
          <TextField
            label="Doğum yılı"
            value={values.birthYear}
            onChangeText={(value) => setField('birthYear', value.replace(/\D/g, '').slice(0, 4))}
            error={errors.birthYear}
            keyboardType="number-pad"
            maxLength={4}
          />
          <SelectField
            label="Yaşadığın şehir"
            placeholder="Şehir seç"
            value={values.residenceCity}
            options={provinceOptions}
            onValueChange={(value) => setField('residenceCity', value)}
            error={errors.residenceCity}
            searchPlaceholder="İl ara"
          />
          <SelectField
            label="Yola çıkacağın şehir"
            placeholder="Şehir seç"
            value={values.departureCity}
            options={provinceOptions}
            onValueChange={(value) => setField('departureCity', value)}
            error={errors.departureCity}
            searchPlaceholder="İl ara"
          />
        </View>

        <View style={{ backgroundColor: colors.divider, height: 1 }} />

        <View style={{ gap: spacing.lg }}>
          <AppText variant="subtitle" weight="800">Askerlik bilgileri</AppText>
          <SelectField
            label="Askerlik türü"
            placeholder="Tür seç"
            value={values.militaryType}
            options={militaryTypeOptions}
            onValueChange={(value) => setField('militaryType', value)}
            error={errors.militaryType}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Celp yılı"
                placeholder="Yıl"
                value={values.militaryYear}
                options={yearOptions}
                onValueChange={(year) => {
                  const nextMonths = createMilitaryMonthOptions(year, referenceDate, storedPeriod);
                  setValues((current) => ({
                    ...current,
                    militaryYear: year,
                    militaryMonth: nextMonths.some(({ value }) => value === current.militaryMonth)
                      ? current.militaryMonth
                      : null,
                  }));
                  clearError('militaryYear');
                  clearError('militaryMonth');
                }}
                error={errors.militaryYear}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Celp ayı"
                placeholder={values.militaryYear === null ? 'Önce yıl' : 'Ay'}
                value={values.militaryMonth}
                options={monthOptions}
                onValueChange={(value) => setField('militaryMonth', value)}
                error={errors.militaryMonth}
                disabled={values.militaryYear === null}
              />
            </View>
          </View>
          {!existingPeriodIsCurrentOrFuture && !periodChanged ? (
            <AppText color="muted" variant="caption">
              Geçmiş celp dönemin korunuyor. Dönemi değiştirirsen yalnızca güncel seçenekleri kullanabilirsin.
            </AppText>
          ) : null}
          <SelectField
            label="Gideceğin şehir"
            placeholder="Şehir seç"
            value={values.militaryCity}
            options={provinceOptions}
            onValueChange={(value) => {
              setValues((current) => ({ ...current, forceCode: null, militaryCity: value, militaryUnit: '', militaryUnitId: null }));
              setUsesUnresolvedMilitaryUnit(false);
              clearError('militaryCity');
              clearError('militaryUnit');
            }}
            error={errors.militaryCity}
            searchPlaceholder="İl ara"
          />
          <View style={{ gap: spacing.sm }}>
            <AppText weight="600">Birlik bilgin var mı?</AppText>
            {renderUnitChoice(false, 'Birliğimi henüz bilmiyorum')}
            {renderUnitChoice(true, 'Birliğimi biliyorum')}
          </View>
          {values.knowsMilitaryUnit ? (
            <View style={{ gap: spacing.md }}>
              {!usesUnresolvedMilitaryUnit ? <SelectField
                label="Askerî birlik"
                value={values.militaryUnitId}
                options={militaryUnitOptions}
                onValueChange={(value) => {
                  const unit = getMilitaryUnitById(value);
                  setValues((current) => ({ ...current, forceCode: unit?.forceCode ?? null, militaryUnit: unit?.name ?? '', militaryUnitId: value }));
                  clearError('militaryUnit');
                }}
                error={errors.militaryUnit}
                placeholder={values.militaryCity ? 'Birlik seç' : 'Önce görev şehrini seç'}
                searchPlaceholder="Birlik veya bilinen adını ara"
                disabled={!values.militaryCity}
              /> : <TextField
                label="Birlik adı"
                value={values.militaryUnit}
                onChangeText={(value) => setField('militaryUnit', value)}
                error={errors.militaryUnit}
                autoCapitalize="sentences"
                maxLength={profileFieldLimits.militaryUnitMax}
              />}
              <Pressable accessibilityRole="button" onPress={() => {
                setUsesUnresolvedMilitaryUnit((current) => !current);
                setValues((current) => ({ ...current, forceCode: null, militaryUnit: '', militaryUnitId: null }));
                clearError('militaryUnit');
              }} style={{ minHeight: 44, justifyContent: 'center' }}>
                <AppText style={{ color: colors.primary }} weight="700">{usesUnresolvedMilitaryUnit ? 'Listeden birlik seç' : 'Birliğimi bulamıyorum'}</AppText>
              </Pressable>
            </View>
          ) : null}
          <DatePickerField
            label="Teslim tarihi"
            value={reportingDate}
            minimumDate={minimumReportingDate}
            onValueChange={(value) => setField('reportingDate', [
              value.getFullYear(),
              String(value.getMonth() + 1).padStart(2, '0'),
              String(value.getDate()).padStart(2, '0'),
            ].join('-'))}
            error={errors.reportingDate}
          />
        </View>

        {submissionError ? (
          <AppText color="danger" variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
            {submissionError}
          </AppText>
        ) : null}

        <Button
          label="Değişiklikleri kaydet"
          loading={isSubmitting}
          disabled={!dirty}
          onPress={() => void handleSave()}
        />
      </ScreenContainer>
    </Modal>
    <DevremConfirmModal
      confirmLabel="Değişiklikleri sil"
      description="Profilden çıkarsan yaptığın değişiklikler kaybolacak."
      destructive
      onClose={() => setDiscardConfirmOpen(false)}
      onConfirm={() => { setDiscardConfirmOpen(false); onClose(); }}
      title="Değişiklikler kaydedilmedi"
      visible={discardConfirmOpen}
    />
    </>
  );
}
