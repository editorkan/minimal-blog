# 블로그

GitHub Pages에 올리는 미니멀 블로그입니다. 실제 로그인, 글 저장, 구독자 저장, 새 글 이메일 발송은 Supabase가 처리합니다.

## 구조

- GitHub Pages: 정적 프론트엔드 호스팅
- Supabase Auth: 관리자 로그인
- Supabase Postgres + RLS: 글/구독자 저장 및 접근 제어
- Supabase Storage: 이미지/영상 첨부 파일 저장
- Supabase Edge Function + Resend: 새 글 이메일 발송

## 1. Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다. 이 SQL은 글, 구독자, 관리자, 첨부 파일용 `post-media` Storage 버킷을 만듭니다.
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

이 함수가 배포되지 않으면 구독자 이메일 저장은 가능하지만, 새 글 업로드 시 자동 이메일 발송은 되지 않습니다.

## 3. 에디터

관리자로 로그인하면 `쓰기` 버튼이 나타납니다.

- `H`, `B`, `I`, `인용`, `링크`: 본문 서식 삽입
- `이미지`, `영상`: Supabase Storage의 `post-media` 버킷에 업로드 후 본문에 첨부
- 본문은 간단한 마크다운 형식으로 저장됩니다.

## 4. GitHub Pages 배포

1. GitHub에 새 저장소를 만듭니다.
2. 이 폴더를 저장소에 push합니다.
3. 저장소의 `Settings` -> `Pages`로 이동합니다.
4. Source를 `Deploy from a branch`로 설정합니다.
5. Branch는 `main`, folder는 `/ (root)`를 선택합니다.

GitHub Pages는 루트의 `index.html`을 진입 파일로 사용합니다.

## 5. Custom Domain

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

데스크톱에서는 `Ctrl+R`을 누르면 관리자 로그인 패널이 열립니다.

모바일에서는 사이트 주소 뒤에 `?admin=1` 또는 `#admin`을 붙여 접속합니다.

```txt
https://editorkan.github.io/minimal-blog/?admin=1
```

Supabase Auth 계정으로 로그인하고, `admin_users`에 등록된 사용자만 글을 작성/수정/삭제할 수 있습니다.
