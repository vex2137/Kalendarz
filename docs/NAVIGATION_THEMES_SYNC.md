# Navigation, custom themes and encrypted sync

Swipe left for the next period and right for the previous period in the calendar
area. Year, month, week and day views advance by their respective period. Schedule
advances by one month and displays the following 60 days. Vertical scrolling,
existing navigation buttons, taps and event editing remain available.

On desktop, Left/Right arrows and A/D navigate the same periods. Shortcuts are
inactive in text inputs, editable content, selects, dialogs, PIN lock, composition,
text selections and modified key combinations. Transitions respect reduced-motion
preferences.

## Custom themes

Settings retains all seven built-in themes and adds local custom themes. Create,
edit, select and delete palettes with 13 colors: page, panels, header, secondary
background, hover, borders, primary and secondary text, accent and accent text,
buttons, button hover and button text. Save applies the palette throughout the app;
cancel discards the draft. Deleting the active custom theme selects Dark OLED.
A contrast notice helps identify unreadable text combinations.

Up to 32 custom themes are stored with local settings. Names are limited to 50
characters; colors are validated six-digit hex values, never arbitrary CSS. The
active custom palette can also accompany a synchronization payload. Event colors
retain their own meaning.

## Encrypted QR and text codes (KAL3)

1. Enter a password of at least 12 characters and generate an encrypted code.
2. Transfer the QR frames, QR images or the encrypted text code. Share the password
   through a separate channel.
3. The receiver assembles all parts, enters the sender's password and selects
   **Decrypt and merge**. Incorrect passwords or damaged data do not import events.

All processing is offline. Passwords are held only transiently in the open dialog,
cleared after use, and never written to settings, exports or QR codes. Closing the
dialog releases its state. The generated ciphertext can remain visible without
retaining the password. Changing the payload requires generating a new code.

The binary envelope is `salt[16] || IV[12] || ciphertext || GCM tag[16]`.
PBKDF2-HMAC-SHA-256 uses a fresh random 128-bit salt and 600,000 iterations to derive
a non-exportable AES-256 key. AES-GCM uses a fresh random 96-bit IV and a 128-bit
authentication tag. Fixed associated data binds the protocol, gzip, KDF settings
and cipher: `Calendar QR v3|gzip|PBKDF2-SHA256|600000|AES-256-GCM`.

JSON is gzip-compressed in a local worker before encryption. Authentication must
succeed before decompression and JSON validation. Bounded gzip input chunks and
an expanded-size limit of 10 MB limit decompression resource use. The compressed
payload is base64-encoded into `KAL3:<SHA256(base64 envelope)>:<base64 envelope>`.
The public checksum identifies ciphertext; it is not used as a substitute for GCM
authentication and does not expose a hash of the plaintext.

Multipart frames use `KAL3P:<checksum>:<index>:<count>:<chunk>`, with chunks of up to
1,000 characters and at most 256 frames. Reordered and duplicate identical frames
are accepted; conflicting parts are rejected. A partial assembly expires after ten
minutes. Large payloads can use the encrypted text code instead of QR.

KAL2, legacy JSON and ICS remain importable with an explicit warning and confirmation.
Plain JSON file exports remain **unencrypted**. Old app versions cannot read KAL3;
update both devices before exchanging encrypted codes. Web Crypto requires a secure
browser origin (HTTPS or localhost); Android uses the existing HTTPS WebView origin,
and the desktop bundle uses its local file origin.


## Android language changes

Interface text and the activity title change immediately. The selected launcher name is persisted, but launcher aliases are changed only in the activity's `onStop` background transition, never while the user is changing language in a visible activity. API 33+ updates all aliases atomically; older systems enable the replacement before disabling others. Exactly one localized launcher entry remains enabled. Configuration changes alone do not apply a pending launcher change.

Android may finish the task associated with an alias when that alias is disabled, even with `DONT_KILL_APP`. This now occurs only after leaving the app; selecting a language in the foreground does not disable any alias. Reopening through the new icon restores the saved language and calendar storage.
