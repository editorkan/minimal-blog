import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const mailFrom = Deno.env.get("MAIL_FROM");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !mailFrom) {
    return json({ error: "Server is not configured" }, 500);
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return json({ error: "Forbidden" }, 403);
  }

  const { post_id, site_url } = await request.json();

  if (!post_id || !site_url) {
    return json({ error: "Missing post_id or site_url" }, 400);
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,title,body")
    .eq("id", post_id)
    .single();

  if (postError || !post) {
    return json({ error: "Post not found" }, 404);
  }

  const { data: subscribers, error: subscribersError } = await supabase
    .from("subscribers")
    .select("email");

  if (subscribersError) {
    return json({ error: "Could not load subscribers" }, 500);
  }

  const emails = subscribers.map((subscriber) => subscriber.email);

  if (emails.length === 0) {
    return json({ sent: 0 });
  }

  const postUrl = `${site_url}#${encodeURIComponent(post.id)}`;
  const excerpt = post.body.split(/\n{2,}/)[0] ?? "";
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
    return json({ error: "Email provider failed" }, 502);
  }

  return json({ sent: emails.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
