# Security Notes

## Scope

This is a static GitHub Pages site. It has no server-side authentication, database, or trusted backend.

## Important Limits

- The hidden admin panel is not a production security boundary.
- Client-side state can be modified by the browser owner.
- Posts created in the browser are local to that browser unless committed to the GitHub repository.
- Email subscribers are stored in local browser storage and are not a real mailing list.

## Safer Publishing Model

Use GitHub account permissions to control production publishing. Only trusted maintainers should have write access to the repository.

For real private admin login, server-side authentication and a backend email service are required.
