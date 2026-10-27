# Registration and password recovery

## Roles
New registrations choose teacher, student or guardian. Teachers provide a workspace name. Students and guardians are created without a teaching workspace and go directly to the matching portal. Class/child links still require a teacher-issued invitation; registration alone grants no class access. Existing accounts and workspace memberships are preserved; legacy accounts default to teacher.

## Recovery implemented without an email provider
Each new account receives a cryptographically random personal recovery code, shown once after registration. Only its SHA-256 hash is stored. The user must save it outside the app before continuing. The code is not stored in localStorage, a cookie, Git or notifications.

Existing users can generate/rotate a code in Account after proving knowledge of the current password. A new code invalidates the previous one. Email or password changes invalidate recovery codes as well.

The public recovery form accepts the login email, saved recovery code and a new password. Recovery atomically consumes the code and revokes all existing sessions. Requests are throttled by IP and hashed email. Class/student/guardian data remains linked to the unchanged user ID. A new code should be generated after the user signs in again.

If both the password and recovery code are lost and no other recovery method is configured, self-service recovery is unavailable. Merely knowing a name, phone or teacher is not accepted as proof of account ownership. An existing session alone cannot generate a code without the current password.

## Email recovery plan — not yet configured
Configure a transactional email sender/domain, then verify account emails. Password-reset requests should always return a generic response, use a short-lived (for example 15 minute) single-use random token stored only as a hash, and revoke sessions after reset. Throttle requests and reset attempts. A phone number is not a recovery factor until ownership verification exists. The present UI does not claim an email has been sent.
