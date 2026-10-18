import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Nexa Flow Seats" },
      { name: "description", content: "How Nexa Flow Seats keeps event and guest data secure." },
      { property: "og:title", content: "Security — Nexa Flow Seats" },
      { property: "og:description", content: "Security practices behind Nexa Flow Seats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Trust"
      title="Security"
      sections={[
        { h: "Isolated organizations", p: "Access rules in the database ensure members only ever see their own organization's events and guests." },
        { h: "Roles and permissions", p: "Owners, event managers and staff each get only the access they need." },
        { h: "Secure guest links", p: "Guests reach their invitation through unique, hard-to-guess links and QR codes, with no account required." },
        { h: "Verified payments", p: "Payments are confirmed with the payment provider before any package is activated." },
      ]}
    />
  ),
});
