import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "org"
  );
}

/** Creates an organization owned by the caller and makes them its owner. */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 7)}`;

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.name, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: context.userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    return { organizationId: org.id };
  });
