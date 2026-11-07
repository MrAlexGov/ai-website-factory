# Python static-site builder

A small, dependency-free builder for projects in this repository.

## Build a project

Requires Python 3.11 or newer (uses the standard-library `tomllib` module).

```bash
python tools/site_factory/build.py --project projects/abu-dhabi-ac
```

The builder reads `site.config.toml` from the project directory, copies the configured source directory to the configured output directory, and validates required files plus local HTML links, assets, and fragment anchors.

## Configuration

```toml
[site]
name = "Example business"

[build]
source = "site"
output = "../../dist/example"
required_files = ["index.html"]
```

All paths are relative to the project directory. The source must stay inside the project; the output must stay inside the repository. The builder deletes and recreates only the configured output directory.

## Design boundaries

- Build step: deterministic file assembly and validation; no AI calls and no hosting credentials.
- Project content: HTML, CSS, JS, images, and project-specific configuration.
- Deployment: a separate CI workflow consumes the build output.
- Hosting providers: add independent deployment adapters later; do not add provider logic to this builder.

The first version intentionally copies static files rather than introducing a framework or package manager. Add minification, image processing, component rendering, or framework support only when a real project needs it.
