from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_memoryos_sdk import NODE, complete_package, reference_snapshot


EXAMPLES = Path(__file__).resolve().parents[2] / "examples" / "python"


class PythonExamplesTest(unittest.TestCase):
    def run_example(self, name: str, *arguments: str) -> dict[str, object]:
        environment = os.environ.copy()
        result = subprocess.run(
            [
                sys.executable,
                str(EXAMPLES / name),
                *arguments,
                "--node",
                NODE,
            ],
            check=True,
            capture_output=True,
            text=True,
            env=environment,
        )
        return json.loads(result.stdout)

    def test_all_published_examples_execute(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            snapshot = root / "snapshot.json"
            package = root / "investigation.mip"
            exported = root / "exported.mip"
            snapshot.write_text(
                json.dumps(reference_snapshot(), ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            package.write_bytes(complete_package())

            observed = self.run_example(
                "observe.py",
                str(snapshot),
                "--identifier",
                "python-example-observe",
            )
            self.assertEqual(observed["lifecycle"], "Observed")

            imported = self.run_example("import_package.py", str(package))
            self.assertEqual(imported["lifecycle"], "Observed")

            replay = self.run_example(
                "replay.py",
                str(package),
                "trace-observation-b",
            )
            self.assertEqual(replay["status"], "completed")

            comparison = self.run_example(
                "compare.py",
                str(package),
                "trace-observation-b",
                "evolution-observation-a-observation-b",
                "comparative-observation-a-observation-b",
            )
            self.assertEqual(comparison["stage"], "compare")

            verified = self.run_example("verify.py", str(package))
            self.assertTrue(verified["valid"])

            self.run_example("export_package.py", str(package), str(exported))
            self.assertEqual(exported.read_bytes(), package.read_bytes())

            batch = self.run_example(
                "batch_verification.py",
                str(package),
                str(exported),
            )
            self.assertTrue(batch["valid"])


if __name__ == "__main__":
    unittest.main()
