import { ModernProfileScreen } from '@/features/profile/ModernProfileScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';

const USE_MODERN_PROFILE = true;

export default USE_MODERN_PROFILE ? ModernProfileScreen : ProfileScreen;
