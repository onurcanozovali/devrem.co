import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rememberGroupChatReturnTab } from '@/features/groups/groupChatNavigation';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<string, IconName> = {
  index: 'home-outline',
  preparation: 'checkmark-circle-outline',
  matching: 'people-outline',
  chats: 'people-circle-outline',
  profile: 'person-outline',
};

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        freezeOnBlur: true,
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name] ?? 'ellipse-outline'} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="preparation" options={{ title: 'Hazırlık' }} />
      <Tabs.Screen name="matching" options={{ title: 'Devreni Bul' }} />
      <Tabs.Screen
        name="chats"
        listeners={({ navigation }) => ({
          tabPress: () => {
            const state = navigation.getState();
            rememberGroupChatReturnTab(state.routes[state.index]?.name);
          },
        })}
        options={{ title: 'Devre Grubum' }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
