# Security Notes

## Security Boundary

GitHub Pages only serves static files. Authentication, authorization, writes, and subscriber access are handled by Supabase.

## Controls

- Admin login uses Supabase Auth, not client-only password checks.
- Admin authorization uses the `admin_users` table and Row Level Security policies.
- Public visitors can read published posts and insert their own email into `subscribers`.
- Public visitors cannot read the subscriber list.
- Post writes require an authenticated admin user.
- Email delivery is performed by a Supabase Edge Function using server-side secrets.
- The frontend includes a restrictive Content Security Policy.
- The email Edge Function should restrict CORS with `ALLOWED_ORIGINS`.

## Residual Risks

- The Supabase anon key is public by design. RLS policies must stay enabled.
- Anyone with GitHub repository write access can change frontend code.
- `config.js` contains public Supabase project metadata only. Do not put service-role keys, Resend keys, or SMTP credentials in frontend files.
- `Ctrl+R` and `#admin` are only hidden entry points, not security controls. Supabase Auth and RLS are the actual controls.

## Deployment Checklist

- Keep `public.posts`, `public.subscribers`, and `public.admin_users` RLS enabled.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase Edge Function secrets.
- Keep `RESEND_API_KEY` only in Supabase Edge Function secrets.
- Set `ALLOWED_ORIGINS` to the production GitHub Pages URL and custom domain.
- Restrict GitHub repository write access to trusted maintainers.
- Enable GitHub Pages HTTPS enforcement for any custom domain.
