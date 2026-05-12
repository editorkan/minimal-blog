# 블로그

GitHub Pages에 올리는 미니멀 블로그입니다. 실제 로그인, 글 저장, 구독자 저장, 새 글 이메일 발송은 Supabase가 처리합니다.

## 구조

- GitHub Pages: 정적 프론트엔드 호스팅
- Supabase Auth: 관리자 로그인
- Supabase Postgres + RLS: 글/구독자 저장 및 접근 제어
- Supabase Edge Function + Resend: 새 글 이메일 발송

## 1. Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Authentication에서 관리자 이메일 계정을 만듭니다.
4. 아래 SQL로 해당 계정을 관리자로 등록합니다.

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL@example.com';
```

5. `config.js`에 Supabase Project URL과 anon key를 입력합니다.

```js
window.BLOG_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
};
```

## 2. 이메일 발송 설정

1. Resend에서 API key를 만들고 발신 도메인을 인증합니다.
2. Supabase CLI로 secrets를 설정합니다.

```bash
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set MAIL_FROM="Blog <post@yourdomain.com>"
supabase secrets set ALLOWED_ORIGINS="https://editorkan.github.io,https://editorkan.github.io/minimal-blog"
```

3. Edge Function을 배포합니다.

```bash
supabase functions deploy notify-subscribers
```

## 3. GitHub Pages 배포

1. GitHub에 새 저장소를 만듭니다.
2. 이 폴더를 저장소에 push합니다.
3. 저장소의 `Settings` -> `Pages`로 이동합니다.
4. Source를 `Deploy from a branch`로 설정합니다.
5. Branch는 `main`, folder는 `/ (root)`를 선택합니다.

GitHub Pages는 루트의 `index.html`을 진입 파일로 사용합니다.

## 4. Custom Domain

심플한 도메인을 쓰려면 도메인을 구매한 뒤 GitHub Pages의 `Custom domain`에 입력합니다.

예:

```txt
blog.example.com
```

DNS에는 보통 아래 중 하나를 설정합니다.

- `blog.example.com` 같은 서브도메인: `CNAME` -> `editorkan.github.io`
- `example.com` 같은 apex 도메인: GitHub Pages가 안내하는 `A` / `AAAA` 레코드

Custom domain을 설정한 뒤 GitHub Pages에서 `Enforce HTTPS`를 켭니다.

## 관리

사이트에서 `Ctrl+R`을 누르면 관리자 로그인 패널이 열립니다. Supabase Auth 계정으로 로그인하고, `admin_users`에 등록된 사용자만 글을 작성/수정/삭제할 수 있습니다.
