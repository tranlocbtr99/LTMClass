"""Exercise a full SQLite backup and restore without production data."""
import sqlite3,pathlib,tempfile,unittest
class RestoreTest(unittest.TestCase):
 def test_restore_schema_and_history(self):
  source=sqlite3.connect(':memory:')
  for file in sorted(pathlib.Path('db/migrations').glob('*.sql')):source.executescript(file.read_text())
  source.executescript("INSERT INTO users(id,email,name,password) VALUES('u','restore@example.test','Test','hash'); INSERT INTO tenants VALUES('t','Test','u'); INSERT INTO students(id,tenant_id,name) VALUES('s','t','Student'); INSERT INTO invoices VALUES('i','t','s','Tuition',100,'2026-11-01'); INSERT INTO payments(id,tenant_id,invoice_id,amount,request_key) VALUES('p','t','i',50,'once');")
  with tempfile.TemporaryDirectory() as directory:
   backup=sqlite3.connect(str(pathlib.Path(directory)/'backup.sqlite'));source.backup(backup);backup.close();saved=sqlite3.connect(str(pathlib.Path(directory)/'backup.sqlite'));restored=sqlite3.connect(':memory:');saved.backup(restored);restored.execute('PRAGMA foreign_keys=ON')
   self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0],'ok');self.assertEqual(restored.execute('SELECT amount FROM payments').fetchone()[0],50);self.assertEqual(restored.execute('SELECT count(*) FROM sqlite_master WHERE type="trigger"').fetchone()[0],9)
   with self.assertRaises(sqlite3.IntegrityError):restored.execute("INSERT INTO payments(id,tenant_id,invoice_id,amount,request_key) VALUES('p2','t','i',50,'once')")
if __name__=='__main__':unittest.main()
