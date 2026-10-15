# ICR2 Modern (web)

A browser remake of Papyrus IndyCar Racing II (1995), playable on phones and
tablets in landscape with touch or tilt steering, and on desktop browsers.

**This repository contains only the game code.** The tracks, cars and liveries
are converted from your own copy of IndyCar Racing II and are never uploaded:
on first start the game asks for your `icr2_data_pack.zip` and keeps it in the
browser's storage on that device.

## Publish (GitHub Pages)
1. Create a repository and upload every file of this folder (keep the folder
   layout; `.nojekyll` included).
2. Settings → Pages → Build and deployment → *Deploy from a branch* → `main`,
   folder `/ (root)` → Save. After a minute the game is at
   `https://<your-user>.github.io/<repository>/`.

A Pages site can be opened by anyone who has its address, even when the
repository is private (Pages from a private repository needs a paid GitHub
plan). That is fine here: the site holds only code, and your data stays on
your own devices.

## Play on a phone
1. Copy `icr2_data_pack.zip` to the phone (AirDrop, iCloud Drive, Google Drive,
   USB). Do not put it in this repository.
2. Open the site. iPhone/iPad: Share → *Add to Home Screen*, then open the game
   from the new icon (do this before loading the data: Safari and the Home
   Screen app keep separate storage). Android: Chrome menu → *Install app*.
3. Tap *Load game data* and pick the pack. It is checked and stored; the game
   starts. Turn the phone sideways.

Updating the game: upload the new files over the old ones. The stored data pack
stays on the phone unless a new build says its format changed.

## Locked game data (data.icr2)
This copy also holds the game data, encrypted (AES-256-GCM, key from the
passphrase by PBKDF2-SHA256). Friends open the site and type the passphrase;
the game downloads and unlocks it by itself and keeps it on their device. A link
ending in `#key=<passphrase>` fills it in for them. Without the passphrase the
file is unreadable. Built with `python tools/build_site.py --locked-pack ...`.
