CREATE TRIGGER homework_publish_notification AFTER UPDATE OF published ON assignments WHEN NEW.published=1 AND OLD.published=0 BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,a.user_id,'assignment:'||NEW.id,'Bài tập mới: '||NEW.title FROM enrollments e JOIN student_accounts a ON a.tenant_id=e.tenant_id AND a.student_id=e.student_id WHERE e.tenant_id=NEW.tenant_id AND e.class_id=NEW.class_id AND e.active=1;
END;
CREATE TRIGGER attendance_change_notification AFTER UPDATE OF status ON attendance WHEN NEW.status<>OLD.status BEGIN
 INSERT INTO notifications(id,tenant_id,user_id,event_key,title) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'attendance-change:'||lower(hex(randomblob(16))),'Điểm danh được sửa: '||NEW.status FROM guardian_links g WHERE g.tenant_id=NEW.tenant_id AND g.student_id=NEW.student_id AND g.revoked_at IS NULL;
END;
