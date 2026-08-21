import { Image, Linking, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import type { AppCampaignPlacement, Campaign, CampaignContext } from './campaignDomain';
import { handleCampaignClick } from './campaignInteractions';
import { resolveCampaignPlacement } from './campaignResolver';

export function CampaignPlacement({ context, placement }: {
  context: CampaignContext;
  placement: AppCampaignPlacement;
}) {
  const campaign = context.placement === placement ? resolveCampaignPlacement({ context, placement }) : null;
  if (!campaign) return null;
  return <SponsoredCampaignCard campaign={campaign} context={context} />;
}

function SponsoredCampaignCard({ campaign, context }: { campaign: Campaign; context: CampaignContext }) {
  const { colors, radii, spacing } = useTheme();
  const destination = campaign.destination.deepLink ?? campaign.destination.url;
  const click = () => {
    if (!destination) return;
    void handleCampaignClick(campaign, context, {
      openDestination: () => Linking.openURL(destination),
    }).catch(() => undefined);
  };
  return <Card accessibilityLabel={`${campaign.disclosureLabel}: ${campaign.creative.title}`} style={{ gap: spacing.md }}>
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      {campaign.creative.logoUrl ? <Image source={{ uri: campaign.creative.logoUrl }} style={{ borderRadius: radii.sm, height: 36, width: 36 }} /> : null}
      <AppText color="muted" variant="caption" weight="800">{campaign.disclosureLabel}</AppText>
    </View>
    {campaign.creative.imageUrl ? <Image resizeMode="cover" source={{ uri: campaign.creative.imageUrl }} style={{ aspectRatio: 16 / 9, borderRadius: radii.md, width: '100%' }} /> : null}
    <View style={{ gap: spacing.xs }}>
      <AppText variant="subtitle" weight="900">{campaign.creative.title}</AppText>
      {campaign.creative.description ? <AppText color="muted">{campaign.creative.description}</AppText> : null}
    </View>
    <Pressable accessibilityRole="link" onPress={click} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 46 })}>
      <AppText weight="800" style={{ color: colors.textInverse }}>{campaign.creative.ctaLabel}</AppText>
    </Pressable>
  </Card>;
}
