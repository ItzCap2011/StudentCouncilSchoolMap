# POWIIS Campus Navigator — GitHub Pages demo

This is the fully static edition of the campus map and timetable demonstration.
It can be hosted directly on GitHub Pages: no Node server, Redis service, Google
OAuth credentials, tokens, or local computer are required after deployment.

## Demo choices

- **User** — opens a synthetic Year 10 timetable and the interactive map.
- **Administrator** — opens the latest student/timetable management panel.

Both choices are public demo identities, not real accounts. Administrator
imports and deletions are stored only in that visitor's browser. They do not
change the repository or affect another visitor.

## Map controls

- Automatically selected classrooms are fitted and centered with surrounding
  map context.
- Scroll the mouse wheel or trackpad vertically to zoom around the pointer.
- Drag the map to pan, or pinch on a touch device to zoom.
- Use the home button to reset the current floor view.

## Mobile layout (v2.9.2)

The layout switches automatically at phone/narrow-screen widths (up to 820px),
and on touch phones in landscape up to 1024px wide and 600px high. No separate
mobile URL or user-agent detection is needed. Wider desktop windows retain the
sidebar layout.

- The green header shows the live time/date, selected week and demo account name.
- Tap the week label to switch Week A/B; tap the name for sign-out and, for the
  Administrator demo, student management.
- Use the floor buttons, drag with one finger, and pinch with two fingers to zoom.
- The green bottom panel shows the current location. Tap its arrow to expand or
  collapse the timetable; scroll lessons independently of the map.
- Tap a lesson to close the timetable, select its floor and center its classroom
  with surrounding space. Opening/closing the panel keeps the selected room
  centered until you manually pan or zoom.
- Clock updates no longer interrupt map exploration or timetable scrolling.
- Phone safe areas, browser-toolbar height changes, landscape, and reduced-motion
  preferences are supported. The smallest screens use a slightly shorter drawer
  to leave the floor controls visible.

The public demo keeps its synthetic account names; the names and sample times
in the design reference are not hardcoded into the header.

## Publish on GitHub Pages

1. Create a new public GitHub repository.
2. Upload every file and folder from this project, keeping `data/` and
   `.github/workflows/` intact.
3. Commit the files to the `main` branch.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **GitHub Actions** as the source.
6. Open the repository's **Actions** tab and wait for **Deploy GitHub Pages**
   to finish.

GitHub will show the public address, normally:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

Future pushes to `main` automatically test and redeploy the site.

## Included synthetic CSV data

- `data/roster.csv` — timetable used by the User demo.
- `data/demo-import.csv` — extra student data for testing Administrator import.
- `data/roster.sample.csv` — small schema example.

The CSV data is downloaded by each visitor's browser. Therefore, only public,
synthetic information belongs in these files.

## Static-site security boundary

GitHub Pages serves public files and cannot protect an administrator area or
keep data secret. This edition must never contain real student data, passwords,
OAuth credentials, API keys, or tokens. Use the separate full-stack edition
when real authentication, private data, shared updates, or permanent server
storage are required.

Before publishing, confirm that you have permission to redistribute the school
name, logo, map artwork, fonts, and other bundled assets.

## Test

```bash
npm test
```

No npm dependencies are installed or shipped.

The tests cover CSV/static-site safety, classroom framing, wheel zoom, touch
gesture transitions, and uninterrupted map exploration between lesson changes.
Responsive browser checks cover 320px, 390px and 430px portrait widths, 800px
landscape, and 1200px desktop. Pinch gestures also have automated event-level
tests; a real iPhone/Android check is recommended after deployment.
