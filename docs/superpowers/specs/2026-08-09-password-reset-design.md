# Password Reset Design

**Date:** 2026-08-09
**Status:** Approved

## Problem

Password reset is broken end to end. `AuthPage.handleForgotPassword` sends a
recovery email with `redirectTo: ${origin}/auth/callback`, and
`AuthCallbackPage` does one thing: bootstrap a workspace and `navigate("/")`.
There is no screen that asks for a new password, so a recovery link drops the
user into the app with the password they could not remember still in force.

The primitive already exists. `SettingsPage.changePassword` calls
`supabase.auth.updateUser({ password })` behind an 8-character check and is
covered by tests. What is missing is a signed-out surface that uses it.

## Approach

Give recovery its own route rather than teaching the callback to branch.

`/auth/callback` exists to hurry an authenticated user into the app. Recovery
needs the opposite: stop, ask for something, then continue. Overloading one
route with both intents means branching on the URL fragment, which is fragile
for the reason described under *Detecting recovery* below.

So: `resetPasswordForEmail` points at a new `/auth/reset`, and the callback is
left exactly as it is.

## Scope

In scope:

- A new `/auth/reset` page with the set-password form and its failure state.
- A shared password-update hook used by both the reset page and settings.
- Changing `redirectTo` on `resetPasswordForEmail`.
- Revoking other sessions after a successful reset.

Out of scope, deliberately:

- **Forwarding old `/auth/callback` recovery links to `/auth/reset`.** Recovery
  links expire after an hour, so this would only serve links sent in the hour
  before deploy, on a single-user app. Doing it properly means capturing the URL
  fragment synchronously before the Supabase client consumes it, which is real
  complexity for a vanishing window. Behaviour for those links is unchanged from
  today: the user is signed in and lands at `/`.
- Password strength metering beyond the existing 8-character minimum.
- Rate limiting. Supabase enforces its own limits on `resetPasswordForEmail`.

## Detecting recovery

The page does not parse the URL. `createClient` is configured with
`detectSessionInUrl: true` ([client.ts:18]), so supabase-js consumes the
recovery fragment asynchronously on init and clears it. Any `useEffect` that
reads `window.location.hash` races that cleanup and will intermittently see an
empty hash.

Instead, the route itself is the signal that this is a recovery flow, and the
only question the page asks is whether a session exists:

- `useAuth().isLoading` — show the satellite loader.
- Session present — show the set-password form.
- No session — show the expired-link state.

This is deterministic, needs no URL handling, and is trivial to test by mocking
`useAuth`.

`RequireAuth` does not apply here; `/auth/reset` is an unguarded route like
`/auth` and `/auth/callback`. Nothing in the app redirects on `SIGNED_IN`
(`use-auth.ts` only tracks state), so the page will not be yanked out from
under the user when the recovery session lands.

## Screens

Both states render in the callback page's shell — starfield, `OrbitFloLogo`,
a centred `orbit-panel` at `max-w-sm`. Not the auth page's two-column
marketing layout: this is a single mid-flow task, and it replaces the screen
the user would otherwise have seen at that moment.

### Set a new password

- Mission label: `RESTORE ACCESS`
- Heading: **Choose a new password.**
- Sub-line: *We will put you back in orbit as soon as it is set.*
- One password field with the reveal toggle, reusing the field idiom from
  [auth-page.tsx:233] — bordered `span`, `LockKeyhole` in `text-cyan-200`,
  `orbit-field-icon-button` for the eye. `autoComplete="new-password"`.
- Submit: **Set password and continue**, `orbit-button w-full`, with the
  `ArrowRight` affordance the auth page uses.

One field, not password-plus-confirm. On a screen reached without knowing your
password, a typo you cannot see sets a password you do not know. Letting the
user look at what they typed addresses that better than making them type it
twice.

On success the page navigates to `/auth/callback`, which bootstraps the
personal workspace and stores the workspace id — the same arrival every other
sign-in path uses. The flow ends inside the app, not at another form.

### Link expired

Reached when there is no session: an expired link, an already-used link, or a
direct visit to `/auth/reset`.

- Heading: **This link has drifted out of range.**
- Sub-line: *Reset links work once and expire after an hour. Send yourself a
  fresh one.*
- An email field and a **Send a new link** button that calls
  `resetPasswordForEmail` in place, with `redirectTo` pointing back at
  `/auth/reset`.
- On success, the existing cyan confirmation treatment: *Check your email for a
  new reset link.*
- A quiet `Back to sign in` link to `/auth`.

The email field is required because there is no session to read an address
from. Asking for it here is still better than bouncing the user to `/auth` to
retype it into a form they must then remember to submit as "forgot password".

## Motion

One verb, tied to real work: `SatelliteLoader` while auth state resolves and
while the password write is in flight. No decorative motion, per the design
language.

## Session revocation

After `updateUser` succeeds, call `supabase.auth.signOut({ scope: "others" })`.
Someone resetting a password may be doing it because they lost control of it;
leaving other sessions alive defeats the point. The current session is
untouched, so the redirect into the app still works.

A failure here is logged to the console and otherwise ignored. The password
change already succeeded, and blocking the user's return over a cleanup call
would be worse than the risk it mitigates.

## Shared hook

Extract the settings implementation into `useUpdatePassword`, in
`src/features/auth/use-update-password.ts`:

```ts
type UseUpdatePassword = {
  updatePassword: (password: string) => Promise<boolean>;
  isUpdating: boolean;
  error: string | null;
  clearError: () => void;
};
```

It owns the 8-character rule, the `updateUser` call, the in-flight flag, and
error copy. It returns `true` on success so callers can decide what happens
next — settings shows *Password updated.* and stays put; the reset page
revokes other sessions and navigates.

`SettingsPage` is refactored onto it in the same change. Two copies of the
validation would drift, and the settings tests already pin the behaviour the
hook must preserve.

## Error handling

- Supabase errors surface with their own message, in the existing violet
  treatment used for `errorMessage` on the auth page.
- Under 8 characters: *Passwords need at least 8 characters.* — the existing
  copy from settings, now owned by the hook.
- `updateUser` rejecting because the recovery session expired between page load
  and submit: the Supabase message surfaces, and the expired-link state is one
  reload away. Not special-cased.

## Testing

`use-update-password.test.ts`:

- Rejects under 8 characters without calling `updateUser`.
- Calls `updateUser({ password })` and resolves `true` on success.
- Surfaces the Supabase error message and resolves `false`.
- Toggles `isUpdating` around the call.

`auth-reset-page.test.tsx`, with `useAuth` mocked:

- Loading state renders the satellite loader.
- With a session, renders the form; submitting calls `updateUser`, then
  `signOut({ scope: "others" })`, then navigates to `/auth/callback`.
- A `signOut` failure still navigates.
- Without a session, renders the expired state, and **Send a new link** calls
  `resetPasswordForEmail` with `redirectTo` ending in `/auth/reset`.
- The reveal toggle switches the input between `password` and `text`.

`auth-page.test.tsx`: update the existing `redirectTo` assertion at line 48 to
`http://localhost:3000/auth/reset`.

`settings-page.test.tsx`: must pass unchanged after the refactor. That is the
point of doing the refactor in the same change.

## Files

- Create: `src/features/auth/use-update-password.ts` + test
- Create: `src/features/auth/auth-reset-page.tsx` + test
- Modify: `src/app/routes.tsx` — add `/auth/reset`, non-lazy like the other
  auth routes
- Modify: `src/features/auth/auth-page.tsx:116` — `redirectTo` to `/auth/reset`
- Modify: `src/features/auth/auth-page.test.tsx:48` — matching assertion
- Modify: `src/features/settings/settings-page.tsx:50-76` — use the hook

No database or migration work. No changes to `auth-callback-page.tsx`.

[client.ts:18]: ../../../src/lib/supabase/client.ts
[auth-page.tsx:233]: ../../../src/features/auth/auth-page.tsx
