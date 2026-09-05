# GitHub Account Health Rules

AuthForge is developed on the user's main GitHub account. Protecting that account is a project requirement.

## Rules

- Keep AuthForge public unless there is a clear reason to change visibility.
- Do not enable paid GitHub plans or billable services as part of normal development.
- Keep GitHub Actions workflows lightweight and avoid unnecessary reruns.
- Do not create large artifact files, binaries, or generated dependency trees in the repository.
- Do not expose secrets, tokens, credentials, personal data, or production connection strings.
- Prefer small, focused commits and issues tied to actual engineering work.
- Do not generate artificial activity, spam issues, spam commits, or unnecessary repository events.
- Before using a new GitHub feature or external service that could affect account limits, billing, or security, check its current implications first.

## Development Workflow

For meaningful changes:

1. Create or update a GitHub issue with acceptance criteria.
2. Inspect the current implementation.
3. Make the smallest necessary change.
4. Add or update tests.
5. Let CI run once for the change.
6. Review the CI result before declaring success.
7. Comment on the issue with the outcome.
8. Close the issue only when its acceptance criteria are actually satisfied.

## Cost Safety

Development should remain local or on GitHub's free/public capabilities wherever practical. Cloud databases, Redis, hosted APIs, paid domains, and other potentially billable infrastructure require an explicit review before use.
