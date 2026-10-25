import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("publication", Path(__file__).with_name("publish-recovered-141.py"))
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


class PublicationGates(unittest.TestCase):
    def test_transport_reassembly_is_byte_exact(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(publication, "MAX_PART", 4):
            directory = Path(temporary)
            entries = {}
            for n, data in enumerate([b"abcd", b"efgh", b"ij"], 1):
                name = f"package.exe.part{n:03}"
                (directory / name).write_bytes(data)
                entries[name] = hashlib.sha256(data).hexdigest()
            expected = b"abcdefghij"
            publication.restore_parts(directory, "package.exe", len(expected), hashlib.sha256(expected).hexdigest(), entries)
            self.assertEqual((directory / "package.exe").read_bytes(), expected)

    def test_corrupt_part_is_rejected_before_it_is_copied(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(publication, "MAX_PART", 4):
            directory = Path(temporary)
            (directory / "package.exe.part001").write_bytes(b"evil")
            with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                publication.restore_parts(directory, "package.exe", 4, hashlib.sha256(b"good").hexdigest(),
                                          {"package.exe.part001": hashlib.sha256(b"good").hexdigest()})
            self.assertEqual((directory / "package.exe").stat().st_size, 0)

    def test_truncated_part_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(publication, "MAX_PART", 4):
            directory = Path(temporary)
            (directory / "package.exe.part001").write_bytes(b"abc")
            with self.assertRaisesRegex(RuntimeError, "Size mismatch"):
                publication.restore_parts(directory, "package.exe", 4, "0" * 64,
                                          {"package.exe.part001": hashlib.sha256(b"abc").hexdigest()})

    def test_transport_manifest_rejects_traversal(self):
        with self.assertRaisesRegex(RuntimeError, "Invalid transport"):
            publication.parse_manifest("0" * 64 + "  ../private.file")

    def test_transport_manifest_rejects_duplicate_names(self):
        line = "0" * 64 + "  package.part001\n"
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            publication.parse_manifest(line + line)

    def test_original_manifest_contains_exactly_the_four_trusted_packages(self):
        parsed = publication.parse_manifest(publication.original_manifest())
        self.assertEqual(set(parsed), set(publication.PACKAGES))
        self.assertEqual(parsed["KALENDARZ-1.4.1-ANDROID.apk"],
                         "d187778c9185af75dfc8c61d8436fe1412e8f0c5c6f85a2cbc5abe8e633a5c89")

    def test_release_cannot_contain_parts(self):
        asset = {"name": "package.exe.part001", "state": "uploaded", "size": 1}
        with self.assertRaisesRegex(RuntimeError, "Unexpected asset"):
            publication.check_asset_metadata({"assets": [asset]}, {"package.exe": (1, "0" * 64)})

    def test_incomplete_draft_cannot_pass_verification(self):
        with self.assertRaisesRegex(RuntimeError, "all five"):
            publication.check_asset_metadata({"assets": []}, {"package.exe": (1, "0" * 64)})

    def test_github_reported_wrong_digest_is_rejected(self):
        asset = {"name": "package.exe", "state": "uploaded", "size": 1, "digest": "sha256:" + "1" * 64}
        with self.assertRaisesRegex(RuntimeError, "digest mismatch"):
            publication.check_asset_metadata({"assets": [asset]}, {"package.exe": (1, "0" * 64)})

    def test_application_changes_cannot_be_released_with_old_binaries(self):
        source = "f" * 40
        def git(*args):
            return source if args[0] == "rev-parse" else "src/App.tsx"
        with patch.object(publication, "git", side_effect=git), patch.object(publication, "run"):
            with self.assertRaisesRegex(RuntimeError, "Application source differs"):
                publication.verify_source(source)

    def test_publication_is_forbidden_outside_actions(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "false"}):
            with self.assertRaisesRegex(RuntimeError, "only on GitHub Actions"):
                publication.publish("f" * 40, Path("unused"))

    def test_wrong_existing_tag_prevents_all_remote_writes(self):
        source = "f" * 40
        data = b"original"
        digest = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "packages").mkdir()
            (directory / "packages/package.exe").write_bytes(data)
            (directory / "packages/SHA256SUMS.txt").write_text(f"{digest}  package.exe\n")
            environment = {"GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": publication.REPOSITORY,
                           "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": source, "GH_TOKEN": "unit-test-only"}
            with patch.dict(os.environ, environment), patch.object(publication, "PACKAGES", {"package.exe": (len(data), digest)}), \
                 patch.object(publication, "verify_source"), patch.object(publication, "tag_commit", return_value="0" * 40), \
                 patch.object(publication, "api", return_value={"object": {"sha": source}}) as api:
                with self.assertRaisesRegex(RuntimeError, "never move"):
                    publication.publish(source, directory)
                self.assertTrue(all(call.args[0] == "GET" for call in api.call_args_list))


if __name__ == "__main__":
    unittest.main()
