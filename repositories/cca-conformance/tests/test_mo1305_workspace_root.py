"""The MO-1305 phase 3D workspace gate derives the root from the repository, not from one machine's path."""
import importlib, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / 'tools/mo1305-phase3d'


class WorkspaceRootGate(unittest.TestCase):
    def setUp(self):
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(TOOLS))
        self.addCleanup(sys.path.remove, str(TOOLS))
        self.common = importlib.import_module('common')

    def test_gate_uses_git_toplevel_and_no_machine_path(self):
        source = (TOOLS / 'common.py').read_text(encoding='utf-8')
        self.assertNotIn('C:/Users', source)
        self.assertIn("textgit('rev-parse','--show-toplevel')", source)

    def test_workspace_check_passes_in_this_checkout(self):
        toplevel = Path(self.common.textgit('rev-parse', '--show-toplevel')).resolve()
        self.assertEqual(self.common.ROOT, toplevel)

    def test_workspace_check_rejects_a_foreign_root(self):
        with tempfile.TemporaryDirectory() as other:
            subprocess.run(['git', 'init', '-q', other], check=True)
            toplevel = Path(self.common.textgit('rev-parse', '--show-toplevel', cwd=Path(other))).resolve()
            self.assertNotEqual(self.common.ROOT, toplevel)


if __name__ == '__main__':
    unittest.main()
