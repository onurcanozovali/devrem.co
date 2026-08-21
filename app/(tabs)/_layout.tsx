import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { rememberGroupChatReturnTab } from '@/features/groups/groupChatNavigation';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<string, IconName> = {
  index: 'home-outline',
  matching: 'search-outline',
  chats: 'chatbubble-outline',
  preparation: 'checkmark-circle-outline',
  profile: 'person-outline',
};

function TabIcon({ color, name, size }: { color: ColorValue; name: string; size: number }) {
  return <Ionicons name={tabIcons[name] ?? 'ellipse-outline'} color={color} size={size} />;
}

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
          <TabIcon color={color} name={route.name} size={size} />
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
        options={{ title: 'Sohbetler' }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
