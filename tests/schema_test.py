import sqlite3,pathlib,unittest
class SchemaTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.executescript(pathlib.Path('db/migrations/0001_core.sql').read_text())
  self.db.executescript("INSERT INTO users VALUES('u','u@a.test','U','hash','now'); INSERT INTO tenants VALUES('a','A','u'),('b','B','u'); INSERT INTO students(id,tenant_id,name) VALUES('sa','a','Student A'),('sb','b','Student B'); INSERT INTO classes(id,tenant_id,name) VALUES('ca','a','Class A'),('cb','b','Class B');")
 def test_cross_tenant_enrollment(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO enrollments VALUES('a','ca','sb',1)")
 def test_cross_tenant_invoice(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO invoices VALUES('i','a','sb','fee',100,'2026-11-01')")
 def test_negative_fee(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO invoices VALUES('i','a','sa','fee',-100,'2026-11-01')")
 def test_payment_idempotency(self):
  self.db.execute("INSERT INTO invoices VALUES('i','a','sa','fee',100,'2026-11-01')");self.db.execute("INSERT INTO payments(id,tenant_id,invoice_id,amount,request_key) VALUES('p','a','i',50,'key')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO payments(id,tenant_id,invoice_id,amount,request_key) VALUES('p2','a','i',50,'key')")
 def test_history_survives_archiving(self):
  self.db.execute("INSERT INTO invoices VALUES('i','a','sa','fee',100,'2026-11-01')");self.db.execute("UPDATE students SET archived=1 WHERE id='sa'");self.assertEqual(self.db.execute('SELECT count(*) FROM invoices').fetchone()[0],1)
if __name__=='__main__':unittest.main()
