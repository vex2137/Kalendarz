"""Local desktop repair only: no AppImage build, Plasma restart, or user-data reset."""
import unittest,tempfile,subprocess,os,json,hashlib,configparser,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];APP='com.vex2137.kalendarz'
class KdeIntegration(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.bundle=self.root/'integration';self.bundle.mkdir();shutil.copy(ROOT/'packaging/linux/install-desktop-entry.sh',self.bundle/'install.sh');shutil.copy(ROOT/'public/desktop-icon.png',self.bundle/'desktop-icon.png');self.image=self.root/'Calendar with space.AppImage';self.image.write_bytes(b'test executable path');self.data=self.root/'xdg';self.desktop=self.data/'applications'/f'{APP}.desktop';self.desktop.parent.mkdir(parents=True);self.env={**os.environ,'XDG_DATA_HOME':str(self.data)}
 def tearDown(self):self.tmp.cleanup()
 def run_helper(self):
  r=subprocess.run(['sh',str(self.bundle/'install.sh'),str(self.image)],env=self.env,text=True,capture_output=True,check=True);return json.loads(r.stdout.splitlines()[0])
 def entry(self):
  c=configparser.ConfigParser(interpolation=None);c.optionxform=str;c.read(self.desktop);return c['Desktop Entry']
 def test_stale_icon_is_replaced_by_absolute_content_addressed_reference(self):
  self.desktop.write_text('[Desktop Entry]\nType=Application\nName=Calendar\nIcon=calendar\nExec=/old/Calendar.AppImage\nStartupWMClass=calendar\nTryExec=/missing/old-app\n')
  old=self.desktop.read_bytes();report=self.run_helper();e=self.entry();icon=Path(e['Icon']);self.assertTrue(icon.is_absolute());self.assertEqual(icon.read_bytes(),(ROOT/'public/desktop-icon.png').read_bytes());self.assertIn(hashlib.sha256(icon.read_bytes()).hexdigest(),icon.name);self.assertEqual(e['StartupWMClass'],APP);self.assertEqual(self.desktop.name,APP+'.desktop');self.assertEqual(e['Exec'],'"'+str(self.image)+'" %U');self.assertNotIn('TryExec',e);self.assertEqual(Path(report['backup']).read_bytes(),old);self.assertFalse(Path(report['backup']).name.endswith('.desktop'))
 def test_repair_is_idempotent_and_preserves_calendar_profiles_and_other_pins(self):
  marker=self.root/'calendar-profile/history-and-model-references.json';marker.parent.mkdir();marker.write_text('{"events":[42],"model":"unchanged.gguf"}');pins=self.root/'plasma-org.kde.plasma.desktop-appletsrc';pins.write_text('launchers=applications:browser.desktop,applications:legacy-calendar.desktop\n');before={p:p.read_bytes() for p in [marker,pins]};self.run_helper();report=self.run_helper();self.assertIsNone(report['backup']);self.assertEqual({p:p.read_bytes() for p in before},before)
 def test_localized_names_custom_actions_and_other_entries_are_preserved(self):
  self.desktop.write_text('[Desktop Entry]\nName=Calendar\nName[pl]=Kalendarz\nActions=Test;\nDBusActivatable=true\n[Desktop Action Test]\nName=Custom\nExec=/bin/true\n');other=self.desktop.with_name('browser.desktop');other.write_text('unchanged');self.run_helper();self.assertEqual(self.entry()['Name[pl]'],'Kalendarz');self.assertEqual(self.entry()['DBusActivatable'],'false');self.assertIn('[Desktop Action Test]',self.desktop.read_text());self.assertEqual(other.read_text(),'unchanged')
 def test_missing_icon_fails_without_modifying_existing_entry(self):
  self.desktop.write_text('[Desktop Entry]\nName=Calendar\nIcon=old\n');before=self.desktop.read_bytes();(self.bundle/'desktop-icon.png').unlink();r=subprocess.run(['sh',str(self.bundle/'install.sh'),str(self.image)],env=self.env,capture_output=True);self.assertNotEqual(r.returncode,0);self.assertEqual(self.desktop.read_bytes(),before)
if __name__=='__main__':unittest.main()
