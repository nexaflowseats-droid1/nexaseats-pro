import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Nexa Flow Seats" },
      { name: "description", content: "How Nexa Flow Seats collects, uses and protects organizer and guest data." },
      { property: "og:title", content: "Privacy Policy — Nexa Flow Seats" },
      { property: "og:description", content: "How we handle organizer and guest data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      sections={[
        { h: "Data we collect", p: "Account details for organizers and team members, and the guest information you add to your events, such as names, contact details, dietary and accessibility needs." },
        { h: "How we use it", p: "Only to run your events: seating, invitations, check-in, communications and billing. We never sell guest data." },
        { h: "Data isolation", p: "Each organization's data is kept separate and is only visible to its own members." },
        { h: "Your rights", p: "You can export or delete your organization's data at any time. Contact us for any privacy request." },
      ]}
    />
  ),
});
