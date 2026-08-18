BEGIN;

CREATE TABLE IF NOT EXISTS access_group_genesys_groups (
    access_group_id BIGINT NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
    genesys_group_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (access_group_id, genesys_group_id)
);

INSERT INTO access_group_genesys_groups (access_group_id, genesys_group_id)
SELECT id, genesys_group_id FROM access_groups
ON CONFLICT (genesys_group_id) DO NOTHING;

INSERT INTO access_group_genesys_groups (access_group_id, genesys_group_id)
SELECT ag.id, mapping.genesys_group_id
FROM access_groups ag
JOIN (
    VALUES
      ('grupo-a', 'f394f058-ab55-4e6b-bc60-62df393e15ca'),
      ('grupo-b', 'dcad72ce-2355-49e6-846e-80fe29eca30c'),
      ('caca-pos', 'f21db0a2-0e99-4367-a3d8-fed60fb70292'),
      ('grupo-home', 'b6a08db3-883a-4bac-bd8f-845df8e1af9d'),
      ('retencao', 'fa6a215a-55bc-4254-bca5-9b8bfda2e970')
) AS mapping(slug, genesys_group_id) ON mapping.slug = ag.slug
ON CONFLICT (genesys_group_id) DO UPDATE
SET access_group_id = EXCLUDED.access_group_id;

CREATE INDEX IF NOT EXISTS idx_access_group_genesys_groups_access_group
    ON access_group_genesys_groups(access_group_id);

COMMIT;
