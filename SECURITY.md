# Security policy

## Reporting a vulnerability

Do not publish exploit details, credentials, personal data, or proof-of-concept attacks in public issues or pull requests. Report suspected vulnerabilities privately to the repository owner through GitHub's private vulnerability reporting or another private channel already agreed with the project maintainers.

Include the affected URL or component, impact, reproduction steps, and the minimum evidence needed to validate the issue. Never include real user passwords, access tokens, service-role keys, or production personal data.

## Production security baseline

- Keep Supabase secret/service-role keys and database credentials only in server-side Vercel environment variables. Never use VITE_, NEXT_PUBLIC_, or other browser-exposed prefixes for secrets.
- Require multi-factor authentication on GitHub, Vercel, Supabase, and the email provider accounts.
- Keep production Storage buckets private. Grant access only through authenticated server routes and validate file type, size, and file contents.
- Keep Row Level Security enabled on exposed Supabase tables. Do not add broad anon or authenticated policies.
- Use least-privilege roles, short-lived sessions, revocation on logout, and server-side authorization checks on every protected route.
- Review dependency alerts, deployment logs, database backups, and access logs regularly.
- Do not deploy unreviewed changes directly to production. Run tests and inspect the pull request before merging.
- Rotate any credential that may have been exposed. Do not paste secrets into chat, issues, commits, or screenshots.

## Current application safeguards

The API applies Helmet security headers and a Content Security Policy, a global API rate limit, a stricter authentication rate limit, and Cache-Control: no-store on versioned API responses. Supabase Storage buckets are private and restricted by file type.
