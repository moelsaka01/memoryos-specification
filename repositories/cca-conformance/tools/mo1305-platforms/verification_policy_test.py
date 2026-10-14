"""Current MO-1305 verification authority and obsolete-methodology rejection."""
from pathlib import Path
import copy
import json
import unittest

ROOT = Path(__file__).resolve().parents[4]
POLICY = Path(__file__).with_name('verification-policy.json')

def validate(p):
    assert p['kind'] == 'MemoryOSRESTVerificationPolicy' and p['version'] == '2.0.0'
    assert p['platform'] == dict(windows11x64='REQUIRED', ubuntu='NOT_REQUIRED', linux='NOT_REQUIRED', vm='NOT_REQUIRED', crossPlatformParity='NOT_REQUIRED')
    assert p['functional'] == dict(cases=105, minimumExecutionsPerCase=1)
    assert p['resources'] == dict(defaultCold=10, defaultWarm=20, maximumCold=30, maximumWarm=50, maximumVectors=20, preferredMaximumVectors=15, extensionScope='INDIVIDUAL_UNSTABLE_VECTOR_ONLY', selectionRequiredBeforeExecution=True, universalRepetition=False)
    assert p['adverse'] == dict(functionalCases=20, functionalMinimumMs=3000, stressDefaultMs=10000, stressDefaultRepetitions=2, stressMaximumMs=20000, stressMaximumRepetitions=3, stressMaximumVectors=10, universalLongStress=False)
    assert p['deadline'] == dict(absoluteCeilingMs=60000, minimumMs=1000, multiplier=4, roundingMs=100)
    assert p['memory'] == dict(headroomNumerator=3, headroomDenominator=2, youngCeilingMiB=128)
    assert p['boundaries'] == 'N-1/N/N+1_OR_SEMANTIC_EQUIVALENT'
    assert p['taskBudget'] == dict(targetSeconds=3600, maximumSeconds=5400)
    assert p['historicalReuseForFinalResources'] is False

class VerificationPolicy(unittest.TestCase):
    def setUp(self):
        self.p = json.loads(POLICY.read_bytes())

    def test_current_authority(self):
        validate(self.p)
        freeze = (ROOT/'docs/mo1305-contract-freeze-1.md').read_text(encoding='utf-8')
        self.assertIn('mo1305-contract-freeze-1-verification-methodology-correction.md', freeze)
        self.assertIn('original freeze, then platform correction', freeze)

    def test_reject_obsolete_universal_sampling(self):
        for key, value in [('defaultCold',30),('defaultWarm',100),('universalRepetition',True)]:
            changed=copy.deepcopy(self.p); changed['resources'][key]=value
            with self.assertRaises(AssertionError): validate(changed)

    def test_reject_long_or_unbounded_stress(self):
        for key, value in [('stressDefaultMs',60000),('stressMaximumMs',60000),('universalLongStress',True),('stressMaximumVectors',20)]:
            changed=copy.deepcopy(self.p); changed['adverse'][key]=value
            with self.assertRaises(AssertionError): validate(changed)

    def test_preserve_platform_headroom_and_coverage(self):
        for group,key,value in [('platform','linux','REQUIRED'),('functional','cases',104),('adverse','functionalCases',19),('memory','headroomNumerator',2),('deadline','multiplier',3),('deadline','absoluteCeilingMs',30000),('resources','maximumWarm',100),('taskBudget','maximumSeconds',5401)]:
            changed=copy.deepcopy(self.p); changed[group][key]=value
            with self.assertRaises(AssertionError): validate(changed)

    def test_r5_witness_arithmetic(self):
        us=9281479
        required=((max(1000000,4*us)+99999)//100000)*100
        self.assertEqual(required,37200)
        self.assertGreater(required,30000)
        self.assertLessEqual(required,self.p['deadline']['absoluteCeilingMs'])

if __name__ == '__main__':
    unittest.main()
