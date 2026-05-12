import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, corsHeaders, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const mailFrom = Deno.env.get("MAIL_FROM");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !mailFrom) {
    return json({ error: "Server is not configured" }, corsHeaders, 500);
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return json({ error: "Unauthorized" }, corsHeaders, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, corsHeaders, 401);
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return json({ error: "Forbidden" }, corsHeaders, 403);
  }

  const { post_id, site_url } = await request.json();

  if (!post_id || !site_url) {
    return json({ error: "Missing post_id or site_url" }, corsHeaders, 400);
  }

  if (!isAllowedSiteUrl(site_url)) {
    return json({ error: "Invalid site_url" }, corsHeaders, 400);
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,title,body")
    .eq("id", post_id)
    .single();

  if (postError || !post) {
    return json({ error: "Post not found" }, corsHeaders, 404);
  }

  const { data: subscribers, error: subscribersError } = await supabase
    .from("subscribers")
    .select("email");

  if (subscribersError) {
    return json({ error: "Could not load subscribers" }, corsHeaders, 500);
  }

  const emails = subscribers.map((subscriber) => subscriber.email);

  if (emails.length === 0) {
    return json({ sent: 0 }, corsHeaders);
  }

  const postUrl = `${site_url}#${encodeURIComponent(post.id)}`;
  const excerpt = getExcerpt(post.body);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom,
      bcc: emails,
      subject: `[블로그] ${post.title}`,
      text: `${post.title}\n\n${excerpt}\n\n${postUrl}`,
    }),
  });

  if (!response.ok) {
    return json({ error: "Email provider failed" }, corsHeaders, 502);
  }

  return json({ sent: emails.length }, corsHeaders);
});

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function isAllowedSiteUrl(siteUrl: string) {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    return false;
  }

  try {
    return allowedOrigins.includes(new URL(siteUrl).origin);
  } catch {
    return false;
  }
}

function getExcerpt(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith("![") && !block.startsWith("@[video"))
    .map((block) =>
      block
        .replace(/^#{2,3}\s+/, "")
        .replace(/^\s*>\s?/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1"),
    )[0] ?? "";
}

function json(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
