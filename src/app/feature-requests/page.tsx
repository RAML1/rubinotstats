import { FeatureRequestsClient } from './FeatureRequestsClient';

export const metadata = {
  title: 'Feature Requests - RubinOT Stats',
  description: 'Suggest and vote on features for RubinOT Stats.',
};

export default function FeatureRequestsPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Feature Requests</h1>
        <p className="text-muted-foreground">
          Suggest features and upvote ideas from the community
        </p>
      </div>
      <FeatureRequestsClient />
    </div>
  );
}
