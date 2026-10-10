import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts/verify-ws63-log.py'

class LogTest(unittest.TestCase):
    def check(self, content, *extra):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'board.log'
            path.write_text(content)
            return subprocess.run([sys.executable, str(SCRIPT), str(path), *extra], capture_output=True)

    def test_skipped_gpio_is_not_a_proof(self):
        log = '\n'.join(['[RustWS63] BOOT', '[RustWS63] RTOS:PASS',
                         '[RustWS63] GPIO:SKIPPED', '[RustWS63] DONE',
                         '[RustWS63] EXIT=0'])
        self.assertEqual(self.check(log).returncode, 0)
        self.assertNotEqual(self.check(log, '--require-gpio').returncode, 0)

    def test_requires_actual_finish(self):
        self.assertNotEqual(self.check('[RustWS63] BOOT\n').returncode, 0)

    def test_rejects_fake_pass_plus_fail(self):
        log = '\n'.join(['[RustWS63] BOOT', '[RustWS63] RTOS:PASS',
                         '[RustWS63] GPIO:PASS', '[RustWS63] DONE',
                         '[RustWS63] EXIT=0', '[RustWS63] GPIO:FAIL'])
        self.assertNotEqual(self.check(log, '--require-gpio').returncode, 0)

if __name__ == '__main__':
    unittest.main()
