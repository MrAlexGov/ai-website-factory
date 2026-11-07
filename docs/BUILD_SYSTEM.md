# Build system — current design

## 1. Goal

Turn a project folder into a predictable, testable static-site artifact. The builder is deliberately separate from hosting: the same output can be deployed to GitHub Pages, Vercel, Netlify, object storage, or a VPS.

## 2. Current MVP

The first implementation is intentionally small and deterministic:

```text
projects/<project>/
  site.config.toml
  site/                 # authored HTML, CSS, JS, images
       |
       v
tools/site_factory/build.py
       |
       +-- copy source to configured output
       +-- check required files
       +-- check local href/src/poster references
       +-- check HTML fragment anchors
       |
       v
dist/<project>/         # deployable artifact
```

Run locally:

```bash
python tools/site_factory/build.py --project projects/abu-dhabi-ac
```

Python 3.11+ is required. The current builder uses only the standard library and has no hosting credentials.

## 3. Project contract

Every buildable project has a `site.config.toml` file. It identifies the project and defines source, output, and required entry points. Paths are relative to the project directory. The builder prevents source paths from escaping the project and output paths from escaping the repository.

Example:

```toml
[site]
name = "Example business"

[build]
source = "site"
output = "../../dist/example"
required_files = ["index.html", "en/index.html"]
```

## 4. Target architecture

Keep these responsibilities separate:

- **Project brief and content:** business facts, languages, sitemap, copy, metadata, and media.
- **Design system:** tokens, typography, spacing, colors, and responsive rules.
- **Block library:** reusable sections such as hero, services, benefits, process, FAQ, testimonials, contact, and footer. Each block will have a stable input contract and documented variants.
- **Page manifests:** ordered lists of block IDs plus project-specific data. A page is assembled from selected blocks rather than generated as one large HTML file.
- **Builder:** validates manifests and block inputs, renders pages, copies assets, and produces `dist/`.
- **QA:** checks links, assets, language direction, metadata, required pages, and eventually accessibility/performance.
- **Deploy adapters:** consume only the finished `dist/` directory. Provider credentials and deployment-specific logic must never enter the renderer.

The next implementation stage is the block renderer: a small manifest format, a shared library of HTML section templates, project-level data files, and automated tests. Keep the current copy-and-validate mode available as a fallback for hand-authored pages.

## 5. Deployment adapters

Use one interface and separate provider implementations:

```text
deploy/
  base.py
  github_pages.py
  vercel.py
  netlify.py
  ssh.py
```

A deploy adapter receives a build directory and deployment configuration. It must not alter source files or decide how pages are rendered. GitHub Pages is the first adapter; other adapters can be added when there is a real target project.

## 6. CI pipeline

1. Checkout repository.
2. Set up a pinned Python version.
3. Build the selected project.
4. Run validation and tests.
5. Upload the build directory as an artifact.
6. Deploy that artifact using the selected provider.

A failed build or validation must stop deployment. A successful build does not imply successful publication.

## 7. Current limitations

- The current MVP copies existing HTML; it does not yet compose pages from reusable blocks.
- GitHub Pages must be enabled once in repository Settings → Pages → Build and deployment → GitHub Actions. The workflow cannot enable it with its current token permissions.
- The current demo form is a visual prototype and does not send leads to a backend.
- No live client domains, credentials, or production integrations are configured.
