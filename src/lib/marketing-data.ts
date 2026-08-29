export const FEATURES = [
  {
    title: "Smart Guest Management",
    body: "Import, group, and track thousands of guests with RSVPs, VIP flags and dietary notes.",
    tone: "primary" as const,
  },
  {
    title: "Interactive Seating",
    body: "Drag tables, drop guests onto seats, and watch the plan snap into place.",
    tone: "primary" as const,
  },
  {
    title: "AI Seating Intelligence",
    body: "Generate arrangements by relationships, conflicts and networking goals in one command.",
    tone: "accent" as const,
  },
  {
    title: "QR Check-in",
    body: "Secure per-guest codes with a live arrival dashboard and duplicate prevention.",
    tone: "primary" as const,
  },
  {
    title: "PDF Management",
    body: "Generate seating charts, invitations and badges, and import venue floor plans.",
    tone: "primary" as const,
  },
  {
    title: "Real-Time Analytics",
    body: "Attendance, RSVP flow and seating efficiency, updating as your event runs.",
    tone: "accent" as const,
  },
];

export const STEPS = [
  "Create your event",
  "Import your guests",
  "Design seating",
  "Send invitations",
  "Check in guests",
  "Monitor live",
];

export const PLANS = [
  {
    name: "Free",
    price: "$0",
    suffix: "",
    featured: false,
    cta: "Start",
    items: ["1 event", "Up to 50 guests", "Basic seating", "Basic QR codes"],
  },
  {
    name: "Professional",
    price: "$49",
    suffix: "/mo",
    featured: true,
    cta: "Choose Pro",
    items: [
      "Up to 1,000 guests",
      "Advanced seating",
      "QR check-in",
      "PDF generation",
      "Analytics",
    ],
  },
  {
    name: "Business",
    price: "$149",
    suffix: "/mo",
    featured: false,
    cta: "Choose Business",
    items: ["Unlimited events", "Unlimited guests", "Advanced analytics", "Team management"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "",
    featured: false,
    cta: "Contact sales",
    items: ["White labeling", "Custom branding", "Custom integrations", "Dedicated support"],
  },
];

export const SOLUTIONS = [
  { name: "Weddings", body: "Families, couples and must-not-sit-together rules handled." },
  { name: "Corporate events", body: "Client hierarchies, sponsor tables and badge printing." },
  { name: "Conferences", body: "Thousand-seat halls, tracks and rapid gate check-in." },
  { name: "Galas & awards", body: "VIP proximity to stage, table hosts and running order." },
  { name: "Fundraisers", body: "Table sponsorship, donor grouping and pledge tracking." },
  { name: "Concerts & festivals", body: "Zoned seating, access tiers and live gate counts." },
  { name: "Religious & government", body: "Protocol seating with strict ordering rules." },
  { name: "Universities & venues", body: "Recurring floor plans reused across the calendar." },
];
