"""Read-only measurement regression controls; no product execution."""
import copy,json,sys,unittest
from pathlib import Path
sys.dont_write_bytecode=True
from timing_analysis import original_measurement,product_observation
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution/native'
FIRST=OUT/'20260927T104635-c3579f';LAST=OUT/'20260927T105158-cf9d52'
raw=json.loads((ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar/github/raw-helper-timing.json').read_bytes())
source=(OUT.parent/'original-probe-transcript/raw-helper-probe.py.txt').read_text()
read=lambda p:json.loads(p.read_bytes())
class TimingRegression(unittest.TestCase):
 def test_original2032_is_not_product_deadline_measurement(self):
  a=original_measurement(raw,source);self.assertEqual(a['classification'],'MEASUREMENT_DEFECT');self.assertEqual(a['elapsedMs'],2031.9999999992433);self.assertIsNone(a['subtractedOverheadMs']);self.assertEqual(a['productDeadlineCompliance'],'NOT_MEASURED')
 def test_small_outer_duration_still_cannot_prove_product_enforcement(self):
  altered=copy.deepcopy(raw);altered['elapsedMs']=1;self.assertEqual(original_measurement(altered,source)['productDeadlineCompliance'],'NOT_MEASURED')
 def test_four_ordinary_actual_observations(self):
  for p in sorted(FIRST.glob('0[1-4]*.stdout.json')):
   with self.subTest(file=p.name):self.assertEqual(product_observation(read(p))['classification'],'OBSERVED_WITHIN_DEADLINE')
 def test_timeout_can_be_observed_after_due_without_late_success(self):
  value=product_observation(read(next(FIRST.glob('05*.stdout.json'))));self.assertFalse(value['lateAccepted']);self.assertGreater(value['terminalAfterDueUpperMs'],0);self.assertEqual(value['classification'],'OBSERVED_FAIL_CLOSED')
 def test_actual_controlled_late_accept_detected(self):
  value=product_observation(read(next(LAST.glob('*.stdout.json'))));self.assertTrue(value['lateAccepted']);self.assertEqual(value['classification'],'PRODUCT_DEADLINE_VIOLATION');self.assertFalse(value['timerFired'])
 def test_no_hidden_rounding_or_grace(self):
  value=read(next(FIRST.glob('01*.stdout.json')));arm=next(e for e in value['events'] if e['event']=='timerArmed');terminal=next(e for e in value['events'] if e['event']=='checkPathsResolved');late=arm['dueUpperMs']+0.000001;terminal['atMs']=late;value['terminalAtMs']=late;value['lateAccepted']=True;value['events'][-1]['atMs']=late+1
  self.assertTrue(product_observation(value)['lateAccepted'])
 def test_modified_frozen_timer_rejected(self):
  value=read(next(FIRST.glob('01*.stdout.json')));next(e for e in value['events'] if e['event']=='timerArmed')['requestedDelayMs']=2001
  with self.assertRaisesRegex(AssertionError,'FROZEN_HELPER_DEADLINE_CHANGED'):product_observation(value)
 def test_suppressed_late_flag_rejected(self):
  value=read(next(LAST.glob('*.stdout.json')));value['lateAccepted']=False
  with self.assertRaisesRegex(AssertionError,'LATE_ACCEPT_FLAG_MISMATCH'):product_observation(value)
 def test_nonmonotonic_events_rejected(self):
  value=read(next(FIRST.glob('01*.stdout.json')));value['events'][1]['atMs']=-1
  with self.assertRaisesRegex(AssertionError,'NON_MONOTONIC_EVENT_RECORD'):product_observation(value)
if __name__=='__main__':unittest.main(verbosity=2)
