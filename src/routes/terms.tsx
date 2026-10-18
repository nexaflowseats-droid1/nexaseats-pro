import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Nexa Flow Seats" },
      { name: "description", content: "The terms for using Nexa Flow Seats event seating and guest management." },
      { property: "og:title", content: "Terms of Service — Nexa Flow Seats" },
      { property: "og:description", content: "Terms for using Nexa Flow Seats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      sections={[
        { h: "Using the service", p: "You are responsible for the accounts in your organization and for having permission to store your guests' information." },
        { h: "Packages and payment", p: "Event credits are activated after payment is confirmed. Package limits such as guest counts apply per event." },
        { h: "Acceptable use", p: "Do not use the service for unlawful activity, spam, or to access other organizations' data." },
        { h: "Changes", p: "We may update these terms and will notify account owners of material changes." },
      ]}
    />
  ),
});
