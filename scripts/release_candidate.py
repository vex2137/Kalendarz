"""Select explicit stable checks without altering historical Part 4 policy."""
import os
if os.environ.get('CALENDAR_FINAL_STABLE')=='true':
 from stable_150_guard import ROOT,policy,expected_android_source,verify_candidate_info
else:
 from part4_beta3_guard import ROOT,policy,expected_android_source,verify_candidate_info
