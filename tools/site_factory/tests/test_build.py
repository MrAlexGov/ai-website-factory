from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build import validate_site  # noqa: E402


class SiteValidationTests(unittest.TestCase):
    def test_valid_local_asset_and_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "assets").mkdir()
            (root / "assets" / "site.css").write_text("body {}", encoding="utf-8")
            (root / "index.html").write_text(
                '<html><body><a href="#contact">Contact</a>'
                '<link href="assets/site.css"><section id="contact"></section>'
                "</body></html>",
                encoding="utf-8",
            )
            self.assertEqual(validate_site(root, ["index.html"]), [])

    def test_reports_missing_asset_and_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "index.html").write_text(
                '<html><body><a href="#missing">Jump</a>'
                '<script src="missing.js"></script></body></html>',
                encoding="utf-8",
            )
            errors = validate_site(root, ["index.html"])
            self.assertEqual(len(errors), 2)
            self.assertTrue(any("broken src" in error for error in errors))
            self.assertTrue(any("missing anchor" in error for error in errors))

    def test_reports_missing_required_page(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "index.html").write_text("<html></html>", encoding="utf-8")
            errors = validate_site(root, ["index.html", "en/index.html"])
            self.assertTrue(any("en/index.html" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
