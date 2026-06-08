# UniqueTab

A browser extension that keeps your pinned tabs unique. When you open a new tab pointing to a URL you already have pinned, UniqueTab closes the duplicate and switches you to the existing pinned tab instead.

## Why

Pinned tabs are usually the apps you keep open all day — mail, calendar, chat, your dashboards. It's easy to click a link or open a bookmark and end up with a second copy of something already pinned. UniqueTab quietly prevents that, so each pinned site stays in exactly one place.

## How it works

- **Detects duplicates of pinned tabs.** Whenever a tab opens or navigates, UniqueTab checks it against the URLs of your currently pinned tabs.
- **Closes the duplicate, focuses the original.** If a match is found, the new tab is closed and the matching pinned tab is brought into focus (switching windows if needed).
- **Smart URL matching.** URLs are normalized before comparison, so small differences are still treated as the same page:
  - `http://` and `https://` are treated as equivalent
  - a leading `www.` is ignored
  - a trailing slash is ignored
  - the `#fragment` part is ignored
  - query strings (`?key=value`) are kept, so genuinely different pages stay separate
- **Leaves system pages alone.** Browser-internal pages (`chrome://`, `about:`, extension pages, the new tab page, etc.) are never touched.

## Features

- **On/off toggle.** Turn duplicate prevention on or off at any time from the popup.
- **Statistics.** See how many duplicate tabs have been merged and when the last merge happened. You can reset the counter whenever you like.
- **Cross-browser.** Works on Chrome and Firefox.

## Usage

1. Install the extension.
2. Pin the tabs you want to keep unique.
3. That's it — open links as usual. Any new tab that matches a pinned URL is automatically merged into the existing one.

Open the toolbar popup to toggle the extension or view your stats.
