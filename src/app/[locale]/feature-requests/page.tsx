import { getTranslations } from 'next-intl/server';
import { FeatureRequestsClient } from './FeatureRequestsClient';

export const metadata = {
  title: 'Feature Requests - RubinOT Stats',
  description: 'Suggest and vote on features for RubinOT Stats.',
};

export default async function FeatureRequestsPage() {
  const t = await getTranslations('featureRequests');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground">
          {t('subheading')}
        </p>
      </div>
      <FeatureRequestsClient />
    </div>
  );
}
