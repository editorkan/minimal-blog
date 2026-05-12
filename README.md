# 블로그

극단적으로 미니멀한 정적 블로그입니다.

## GitHub Pages 배포

1. GitHub에 새 저장소를 만듭니다.
2. 이 폴더를 저장소에 push합니다.
3. 저장소의 `Settings` -> `Pages`에서 source를 `Deploy from a branch`로 설정합니다.
4. Branch는 `main`, folder는 `/ (root)`를 선택합니다.

GitHub Pages는 HTML, CSS, JavaScript 정적 파일을 저장소에서 직접 배포합니다.

## 관리

`Ctrl+R`로 로컬 관리자 패널을 열 수 있습니다.

이 기능은 정적 사이트 안에서만 동작하는 로컬 관리 도구입니다. GitHub Pages에 올라간 공개 사이트의 실제 게시물 발행 권한은 GitHub 저장소 권한으로 관리해야 합니다.

## 보안 메모

- 프론트엔드 로그인은 서버 인증이 아니므로 공개 사이트의 보안 경계로 사용하면 안 됩니다.
- 글, 구독자, 관리자 계정 정보는 현재 브라우저의 `localStorage`에 저장됩니다.
- 자동 이메일 발송은 정적 사이트만으로 불가능합니다. 현재는 `mailto`를 통해 메일 작성창을 여는 방식입니다.
