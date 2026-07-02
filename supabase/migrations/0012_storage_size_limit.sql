-- 0012_storage_size_limit.sql
-- Set an explicit object size limit on session-audio instead of relying on
-- an undocumented implicit default. 50MB is the platform ceiling for this
-- project's plan tier (setting a bucket-level limit above it is rejected) —
-- it is also generous headroom over a worst-case MAX_RECORDING_MS (60min)
-- session at the client's configured 32kbps recording bitrate (~14.4MB).

UPDATE storage.buckets
SET file_size_limit = 50 * 1024 * 1024
WHERE id = 'session-audio';
