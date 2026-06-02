# Security Policy

Vanguard handles highly sensitive personal data: voice notes, plans, biometric
signals, food logs, activity history, calendar data, and model outputs.

## Supported Versions

This repository is an active prototype. Security fixes should target the
current `main` branch unless a release branch exists.

## Reporting a Vulnerability

Do not open public issues for secrets, private data leaks, authentication bugs,
or database authorization issues.

Report privately to the repository maintainer through the contact method listed
on the GitHub repository profile.

Include:

- affected file/function/table
- reproduction steps
- expected impact
- whether any secret or user data may have been exposed

## Secret Handling

Never commit:

- `.env` or `.env.local`
- Supabase service role keys
- Telegram bot tokens or chat IDs
- OpenAI, DeepSeek, Strava, Google, Yazio, or Oura credentials
- raw exports containing biometric, voice, calendar, or activity data

Run before publishing or opening a pull request:

```bash
npm run oss:audit
```

## Data Safety

The public repository should contain code, schemas, and synthetic examples only.
It should not contain real user stream entries, voice transcripts, run exports,
food logs, biometric rows, calendar events, or personal affirmations/scripts.
