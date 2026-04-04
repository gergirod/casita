import { OnboardingWizard } from "@/components/onboarding-wizard";
import { requireOwner } from "@/lib/auth";

export default async function OnboardingPage() {
  await requireOwner();
  return <OnboardingWizard />;
}
