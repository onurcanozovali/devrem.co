import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import {
  createMilitaryMonthOptions,
  createMilitaryYearOptions,
  provinceOptions,
} from '@/features/profile/profileOptions';
import type { UserProfile } from '@/features/profile/types/profile';
import { useTheme } from '@/theme/ThemeProvider';
import type { DiscoveryFilters } from '../types/discovery';

const allProvinceOptions = [{ value: 0, label: 'Tüm şehirler' }, ...provinceOptions];

interface DiscoveryFilterModalProps {
  filters: DiscoveryFilters;
  profile: UserProfile;
  onApply: (filters: DiscoveryFilters) => void;
  onClose: () => void;
}

export function DiscoveryFilterModal({ filters, profile, onApply, onClose }: DiscoveryFilterModalProps) {
  const { colors, spacing } = useTheme();
  const [referenceDate] = useState(() => new Date());
  const [year, setYear] = useState(filters.militaryPeriodYear);
  const [month, setMonth] = useState<number | null>(filters.militaryPeriodMonth);
  const [militaryCity, setMilitaryCity] = useState<number>(filters.militaryCity ?? 0);
  const [departureCity, setDepartureCity] = useState<number>(filters.departureCity ?? 0);
  const storedPeriod = useMemo(() => ({
    year: profile.militaryPeriodYear,
    month: profile.militaryPeriodMonth,
  }), [profile.militaryPeriodMonth, profile.militaryPeriodYear]);
  const yearOptions = useMemo(
    () => createMilitaryYearOptions(referenceDate, profile.militaryPeriodYear),
    [profile.militaryPeriodYear, referenceDate],
  );
  const monthOptions = useMemo(
    () => createMilitaryMonthOptions(year, referenceDate, storedPeriod),
    [referenceDate, storedPeriod, year],
  );

  const resetToProfile = () => {
    setYear(profile.militaryPeriodYear);
    setMonth(profile.militaryPeriodMonth);
    setMilitaryCity(profile.militaryCity);
    setDepartureCity(profile.departureCity);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <ScreenContainer contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtreleri kapat"
            hitSlop={12}
            onPress={onClose}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="800">Keşfi filtrele</AppText>
            <AppText color="muted" variant="caption">Dönem ve şehirleri daralt</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={resetToProfile} style={{ justifyContent: 'center', minHeight: 44 }}>
            <AppText weight="700" style={{ color: colors.primary }}>Sıfırla</AppText>
          </Pressable>
        </View>

        <View style={{ gap: spacing.lg }}>
          <AppText variant="subtitle" weight="800">Askerlik dönemi</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Yıl"
                placeholder="Yıl"
                value={year}
                options={yearOptions}
                onValueChange={(nextYear) => {
                  setYear(nextYear);
                  const nextMonths = createMilitaryMonthOptions(nextYear, referenceDate, storedPeriod);
                  if (!nextMonths.some(({ value }) => value === month)) setMonth(nextMonths[0]?.value ?? null);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField label="Ay" placeholder="Ay" value={month} options={monthOptions} onValueChange={setMonth} />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: colors.border, height: 1 }} />

        <View style={{ gap: spacing.lg }}>
          <AppText variant="subtitle" weight="800">Şehirler</AppText>
          <SelectField
            label="Gideceği şehir"
            placeholder="Şehir seç"
            value={militaryCity}
            options={allProvinceOptions}
            onValueChange={setMilitaryCity}
            searchPlaceholder="İl ara"
          />
          <SelectField
            label="Yola çıkacağı şehir"
            placeholder="Şehir seç"
            value={departureCity}
            options={allProvinceOptions}
            onValueChange={setDepartureCity}
            searchPlaceholder="İl ara"
          />
        </View>

        <Button
          label="Sonuçları göster"
          disabled={month === null}
          onPress={() => {
            if (month === null) return;
            onApply({
              militaryPeriodYear: year,
              militaryPeriodMonth: month,
              militaryCity: militaryCity === 0 ? null : militaryCity as UserProfile['militaryCity'],
              departureCity: departureCity === 0 ? null : departureCity as UserProfile['departureCity'],
            });
          }}
        />
      </ScreenContainer>
    </Modal>
  );
}