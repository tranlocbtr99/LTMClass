ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN content TEXT NOT NULL DEFAULT '';
CREATE TABLE class_announcements (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,class_id TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN('general','schedule','assignment')),title TEXT NOT NULL,content TEXT NOT NULL,request_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,request_key),FOREIGN KEY(tenant_id,class_id) REFERENCES classes(tenant_id,id));
CREATE INDEX announcements_class ON class_announcements(tenant_id,class_id,created_at);
CREATE TRIGGER guardian_homework_notification AFTER INSERT ON assignments WHEN NEW.published=1 BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title,content) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'assignment:'||NEW.id,'Bài tập mới: '||NEW.title,NEW.instructions FROM enrollments e JOIN guardian_links g ON g.tenant_id=e.tenant_id AND g.student_id=e.student_id WHERE e.tenant_id=NEW.tenant_id AND e.class_id=NEW.class_id AND e.active=1 AND g.revoked_at IS NULL;
END;
CREATE TRIGGER guardian_homework_publish_notification AFTER UPDATE OF published ON assignments WHEN NEW.published=1 AND OLD.published=0 BEGIN
 INSERT OR IGNORE INTO notifications(id,tenant_id,user_id,event_key,title,content) SELECT lower(hex(randomblob(16))),NEW.tenant_id,g.user_id,'assignment:'||NEW.id,'Bài tập mới: '||NEW.title,NEW.instructions FROM enrollments e JOIN guardian_links g ON g.tenant_id=e.tenant_id AND g.student_id=e.student_id WHERE e.tenant_id=NEW.tenant_id AND e.class_id=NEW.class_id AND e.active=1 AND g.revoked_at IS NULL;
END;
