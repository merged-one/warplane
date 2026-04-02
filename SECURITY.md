# Security Policy

## Supported versions

| Version     | Supported |
| ----------- | --------- |
| main (HEAD) | Yes       |

## Reporting a vulnerability

If you discover a security vulnerability in Warplane, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Disclosure process

1. **Email** the maintainers at the email listed in the repo's GitHub profile,
   or use GitHub's private vulnerability reporting feature:
   _Repository > Security > Advisories > Report a vulnerability_

2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. **Response timeline:**
   - Acknowledgment within 48 hours
   - Initial assessment within 7 days
   - Fix or mitigation plan within 30 days

4. We will coordinate disclosure with you and credit you in the advisory
   (unless you prefer to remain anonymous).

## Scope

This policy covers:

- All code in the `warplane` repository
- The API server (`apps/api`)
- The CLI (`packages/cli`)
- The web dashboard (`apps/web`)
- Build and CI scripts

## Out of scope

- Third-party dependencies (report upstream)
- The Avalanche network itself
- Issues in tmpnet or Avalanche SDK (report to Ava Labs)
