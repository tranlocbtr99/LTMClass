CREATE TRIGGER prevent_lesson_overlap BEFORE INSERT ON lessons
WHEN EXISTS(SELECT 1 FROM lessons l WHERE l.tenant_id=NEW.tenant_id AND l.class_id=NEW.class_id AND l.starts_at<NEW.ends_at AND l.ends_at>NEW.starts_at)
BEGIN SELECT RAISE(ABORT,'SCHEDULE_OVERLAP'); END;
