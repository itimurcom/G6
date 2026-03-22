-- P1: documents cabinet performance indexes
-- Safe additive migration for calendar.localhost.

SET @db_name := DATABASE();

SET @has_idx_documents_active_created := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = @db_name
      AND table_name = 'documents'
      AND index_name = 'idx_documents_active_created'
);
SET @sql_documents_active_created := IF(
    @has_idx_documents_active_created = 0,
    'ALTER TABLE documents ADD INDEX idx_documents_active_created (deleted_at, created_at, id)',
    'SELECT 1'
);
PREPARE stmt_documents_active_created FROM @sql_documents_active_created;
EXECUTE stmt_documents_active_created;
DEALLOCATE PREPARE stmt_documents_active_created;

SET @has_idx_documents_uploader_active_created := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = @db_name
      AND table_name = 'documents'
      AND index_name = 'idx_documents_uploader_active_created'
);
SET @sql_documents_uploader_active_created := IF(
    @has_idx_documents_uploader_active_created = 0,
    'ALTER TABLE documents ADD INDEX idx_documents_uploader_active_created (uploaded_by_user_id, deleted_at, created_at, id)',
    'SELECT 1'
);
PREPARE stmt_documents_uploader_active_created FROM @sql_documents_uploader_active_created;
EXECUTE stmt_documents_uploader_active_created;
DEALLOCATE PREPARE stmt_documents_uploader_active_created;
