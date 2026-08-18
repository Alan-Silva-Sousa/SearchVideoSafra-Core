BEGIN;

ALTER TABLE access_group_genesys_groups
    ADD COLUMN IF NOT EXISTS media_kind VARCHAR(10) NOT NULL DEFAULT 'audio';

UPDATE access_group_genesys_groups
SET media_kind = 'video'
WHERE genesys_group_id IN (
    'f394f058-ab55-4e6b-bc60-62df393e15ca',
    'dcad72ce-2355-49e6-846e-80fe29eca30c',
    'f21db0a2-0e99-4367-a3d8-fed60fb70292',
    'b6a08db3-883a-4bac-bd8f-845df8e1af9d',
    'fa6a215a-55bc-4254-bca5-9b8bfda2e970'
);

ALTER TABLE access_group_genesys_groups
    DROP CONSTRAINT IF EXISTS access_group_genesys_groups_media_kind_check;

ALTER TABLE access_group_genesys_groups
    ADD CONSTRAINT access_group_genesys_groups_media_kind_check
    CHECK (media_kind IN ('audio', 'video'));

CREATE INDEX IF NOT EXISTS idx_access_group_genesys_groups_media
    ON access_group_genesys_groups(media_kind, genesys_group_id);

COMMIT;
