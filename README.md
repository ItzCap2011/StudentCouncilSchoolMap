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
