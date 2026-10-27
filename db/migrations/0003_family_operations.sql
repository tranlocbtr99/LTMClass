CREATE TABLE guardian_links (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,student_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),verified_by TEXT NOT NULL REFERENCES users(id),verified_at TEXT NOT NULL,revoked_at TEXT,UNIQUE(tenant_id,student_id,user_id),FOREIGN KEY(tenant_id,student_id) REFERENCES students(tenant_id,id));
CREATE TABLE guardian_invites (token_hash TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,student_id TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,used_at INTEGER,FOREIGN KEY(tenant_id,student_id) REFERENCES students(tenant_id,id));
CREATE TABLE notifications (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),user_id TEXT NOT NULL REFERENCES users(id),event_key TEXT NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,read_at TEXT,UNIQUE(user_id,event_key));
CREATE INDEX notifications_user ON notifications(user_id,created_at);
CREATE TRIGGER homework_notification AFTER INSERT ON assignments WHEN NEW.published=1 BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,a.user_id,'assignment:'||NEW.id,'Bài tập mới: '||NEW.title FROM enrollments e JOIN student_accounts a ON a.tenant_id=e.tenant_id AND a.student_id=e.student_id WHERE e.tenant_id=NEW.tenant_id AND e.class_id=NEW.class_id AND e.active=1;
END;
CREATE TRIGGER grade_notification AFTER UPDATE OF graded_at ON submissions WHEN NEW.graded_at IS NOT NULL BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,a.user_id,'grade:'||NEW.id||':'||NEW.graded_at,'Bài tập đã được chấm điểm' FROM student_accounts a WHERE a.tenant_id=NEW.tenant_id AND a.student_id=NEW.student_id;
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'grade:'||NEW.id||':'||NEW.graded_at,'Bài tập của học viên đã được chấm điểm' FROM guardian_links g WHERE g.tenant_id=NEW.tenant_id AND g.student_id=NEW.student_id AND g.revoked_at IS NULL;
END;
CREATE TRIGGER attendance_notification AFTER INSERT ON attendance BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'attendance:'||NEW.lesson_id||':'||NEW.student_id,'Điểm danh đã được cập nhật: '||NEW.status FROM guardian_links g WHERE g.tenant_id=NEW.tenant_id AND g.student_id=NEW.student_id AND g.revoked_at IS NULL;
END;
CREATE TRIGGER payment_notification AFTER INSERT ON payments BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'payment:'||NEW.id,'Giáo viên đã ghi nhận thanh toán học phí' FROM invoices i JOIN guardian_links g ON g.tenant_id=i.tenant_id AND g.student_id=i.student_id WHERE i.id=NEW.invoice_id AND i.tenant_id=NEW.tenant_id AND g.revoked_at IS NULL;
END;
