# Mobile verification and acceptance

This document separates checks that can run in the repository from cases that
must be exercised in a signed ClosetMuse development or preview build. Expo Go
cannot validate branded iOS privacy dialogs.

## Automated checks

Run from `apps/mobile`:

```sh
npx tsc --noEmit
npm run verify:native-permissions
npm run export:ios
```

Expected results:

- TypeScript completes without diagnostics.
- `verify:native-permissions` evaluates `expo config --type introspect`, not
  just `app.json`, and requires the branded Camera and Location When In Use
  strings. It rejects Photos, Microphone, Always Location, background-location,
  and the prohibited Android media/audio permissions.
- `export:ios` completes and writes the production iOS JavaScript bundle to
  `dist/`.

### Current automated-test limitation

The mobile package does not currently declare a Jest runner, `jest-expo`, or a
React Native Testing Library dependency. There are consequently no runnable
Jest/controller/component suites for the Style Me turn controller, picker
permission states, keyboard interaction, or packing-card expansion. Do not
represent these cases as automated coverage until that test stack is explicitly
added and tests are implemented.

## Focused static review

The implementation has code paths for the following, but code inspection is
not a substitute for the device scenarios below:

- Style Me clears the composer once it accepts a non-retry send; its synchronous
  in-flight ref blocks duplicate sends. Failed turns retain a request ID and
  use Retry/Edit rather than restoring the composer automatically.
- The chat list uses `keyboardShouldPersistTaps="handled"`, interactive iOS
  keyboard dismissal, and only scrolls when a new-message scroll intent was
  set. Packing expansion is keyed outside the virtualized card row.
- Gallery selection calls the system picker without a media-library permission
  request. Camera flow guards rapid taps, handles retryable versus terminal
  denial, and makes cancellation silent.

## Physical iOS acceptance checklist

Run this in a freshly installed native ClosetMuse development or preview build
on both a small and a large iPhone. Record device, iOS version, build SHA, and
outcome for every case.

### Permissions and weather

- [ ] Fresh install: Camera prompt uses the exact ClosetMuse copy.
- [ ] Fresh install: Location When In Use prompt uses the exact ClosetMuse copy.
- [ ] Gallery opens and cancellation returns silently without a Photos prompt.
- [ ] Camera capture cancellation returns silently; unavailable camera is safe.
- [ ] Camera: allow, retryable denial, terminal denial, Cancel, Open Settings,
  return-to-app recovery.
- [ ] Location: allow, retryable denial, terminal denial, Settings recovery,
  approximate location, and disabled Location Services.
- [ ] Location is requested only from the explicit Enable Location action; when
  unavailable, Style Me does not describe fallback data as live weather.

### Uploads

- [ ] HEIC, PNG, a large image, corrupt image, and empty image each give the
  expected preprocessing/validation outcome.
- [ ] Offline and slow-network uploads show a recoverable stage/error; retry
  reuses the original operation ID.
- [ ] Background/resume, expired session, rapid repeated taps, cancellation,
  and cleanup leave no duplicate item or image.

### Style Me and layout

- [ ] At 320, 375, and 430 point widths plus maximum Dynamic Type, submit a
  prompt and verify immediate composer clearing and one user bubble only.
- [ ] Simulate a request failure: Retry uses the existing bubble/request ID;
  Edit is explicit; submitted text never repopulates automatically.
- [ ] Verify slow response, timeout, navigation/unmount, and return-key/Send/
  chip races never leave the composer stuck or append duplicate messages.
- [ ] Long responses and image loads preserve reading position; a long packing
  response opens at its heading rather than jumping to its bottom.
- [ ] Packing cards are full width, labels/warnings wrap, and expanding/collapsing
  outfit ideas preserves the current scroll position.
