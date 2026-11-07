#!/usr/bin/env python3
"""Build a project site from its site.config.toml using only the Python stdlib."""

from __future__ import annotations

import argparse
import shutil
import sys
import tomllib
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[2]


class ReferenceParser(HTMLParser):
    """Collect local HTML references and IDs for lightweight link validation."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.add(element_id)
        for attribute in ("href", "src", "poster"):
            value = values.get(attribute)
            if value:
                self.references.append((attribute, value))


def inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def load_config(project: Path) -> dict:
    config_path = project / "site.config.toml"
    if not config_path.is_file():
        raise ValueError(f"Configuration not found: {config_path}")
    with config_path.open("rb") as stream:
        return tomllib.load(stream)


def validate_site(output: Path, required_files: list[str]) -> list[str]:
    errors: list[str] = []
    for required in required_files:
        if not (output / required).is_file():
            errors.append(f"Required file is missing: {required}")

    html_files = sorted(output.rglob("*.html"))
    if not html_files:
        errors.append("No HTML files found in the build output.")
        return errors

    parsed: dict[Path, ReferenceParser] = {}
    for html_file in html_files:
        parser = ReferenceParser()
        try:
            parser.feed(html_file.read_text(encoding="utf-8"))
            parser.close()
        except (OSError, UnicodeError) as exc:
            errors.append(f"Cannot read {html_file.relative_to(output)}: {exc}")
            continue
        parsed[html_file] = parser

    for html_file, parser in parsed.items():
        for attribute, raw_url in parser.references:
            url = urlsplit(raw_url.strip())
            if url.scheme or url.netloc or raw_url.startswith("//"):
                continue
            if attribute == "href" and not url.path and url.fragment:
                target_file = html_file
            elif url.path.startswith("/"):
                target_file = output / unquote(url.path.lstrip("/"))
            elif url.path:
                target_file = html_file.parent / unquote(url.path)
            else:
                continue

            target_file = target_file.resolve()
            if not inside(target_file, output.resolve()):
                errors.append(
                    f"{html_file.relative_to(output)}: reference escapes output: {raw_url}"
                )
                continue
            if target_file.is_dir():
                target_file = target_file / "index.html"
            if not target_file.is_file():
                errors.append(
                    f"{html_file.relative_to(output)}: broken {attribute}: {raw_url}"
                )
                continue
            if url.fragment and target_file.suffix.lower() == ".html":
                target_parser = parsed.get(target_file)
                if target_parser and unquote(url.fragment) not in target_parser.ids:
                    errors.append(
                        f"{html_file.relative_to(output)}: missing anchor "
                        f"'{url.fragment}' in {target_file.relative_to(output)}"
                    )
    return errors


def build(project_arg: str) -> Path:
    project = (REPO_ROOT / project_arg).resolve()
    if not inside(project, REPO_ROOT) or not project.is_dir():
        raise ValueError("Project must be an existing directory inside the repository.")

    config = load_config(project)
    build_config = config.get("build", {})
    source = (project / build_config.get("source", "site")).resolve()
    output = (project / build_config.get("output", "../../dist/site")).resolve()
    required_files = build_config.get("required_files", ["index.html"])

    if not inside(source, project) or not source.is_dir():
        raise ValueError("Build source must be an existing directory inside the project.")
    if not inside(output, REPO_ROOT) or output == REPO_ROOT:
        raise ValueError("Build output must be a subdirectory of the repository.")
    if output == source or inside(source, output):
        raise ValueError("Build output cannot replace or contain the source directory.")
    if not isinstance(required_files, list) or not all(
        isinstance(item, str) for item in required_files
    ):
        raise ValueError("'required_files' must be an array of relative paths.")

    if output.exists():
        shutil.rmtree(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, output)

    errors = validate_site(output, required_files)
    if errors:
        shutil.rmtree(output, ignore_errors=True)
        raise RuntimeError("Build validation failed:\n- " + "\n- ".join(errors))

    file_count = sum(1 for item in output.rglob("*") if item.is_file())
    print(f"Built {config.get('site', {}).get('name', project.name)}")
    print(f"Output: {output.relative_to(REPO_ROOT)}")
    print(f"Files: {file_count}")
    print(f"HTML pages checked: {len(list(output.rglob('*.html')))}")
    print("Validation: passed")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        required=True,
        help="Project directory relative to the repository root.",
    )
    args = parser.parse_args()
    try:
        build(args.project)
    except (OSError, ValueError, RuntimeError, tomllib.TOMLDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
