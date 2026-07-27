CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS searchvideo;

CREATE TABLE IF NOT EXISTS searchvideo.gravacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sistema_origem VARCHAR(100) NOT NULL,
    id_origem VARCHAR(255) NOT NULL,

    data_gravacao DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME,
    duracao_segundos INTEGER CHECK (duracao_segundos IS NULL OR duracao_segundos >= 0),

    agente_id VARCHAR(255),
    agente_login VARCHAR(255),
    agente_nome VARCHAR(255),
    origem VARCHAR(255),
    destino VARCHAR(255),
    direcao VARCHAR(30),

    campanha_id VARCHAR(255),
    campanha_nome VARCHAR(255),
    disposicao_id VARCHAR(255),
    disposicao_nome VARCHAR(255),

    cpf VARCHAR(20),
    cnpj VARCHAR(20),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    ec VARCHAR(50),
    contrato VARCHAR(100),
    protocolo VARCHAR(100),

    s3_bucket VARCHAR(255) NOT NULL,
    s3_object_key TEXT NOT NULL,
    nome_arquivo VARCHAR(500) NOT NULL,
    tamanho_bytes BIGINT CHECK (tamanho_bytes IS NULL OR tamanho_bytes >= 0),
    content_type VARCHAR(100) NOT NULL DEFAULT 'video/mp4',
    hash_integridade VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_gravacoes_origem UNIQUE (sistema_origem, id_origem)
);

CREATE TABLE IF NOT EXISTS searchvideo.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    senha_hash TEXT,
    perfil VARCHAR(50) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS searchvideo.permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil VARCHAR(50) NOT NULL,
    recurso VARCHAR(100) NOT NULL,
    acao VARCHAR(50) NOT NULL,

    CONSTRAINT uq_permissoes UNIQUE (perfil, recurso, acao)
);

CREATE TABLE IF NOT EXISTS searchvideo.log_auditoria (
    id BIGSERIAL PRIMARY KEY,
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id UUID REFERENCES searchvideo.usuarios(id) ON DELETE SET NULL,
    usuario_login VARCHAR(255),
    perfil VARCHAR(50),
    acao VARCHAR(100) NOT NULL,
    gravacao_id UUID REFERENCES searchvideo.gravacoes(id) ON DELETE SET NULL,
    ip_origem INET,
    resultado VARCHAR(50) NOT NULL,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gravacoes_data_hora
    ON searchvideo.gravacoes (data_gravacao DESC, hora_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_gravacoes_agente
    ON searchvideo.gravacoes (agente_id);

CREATE INDEX IF NOT EXISTS idx_gravacoes_agente_login
    ON searchvideo.gravacoes (agente_login);

CREATE INDEX IF NOT EXISTS idx_gravacoes_origem
    ON searchvideo.gravacoes (origem);

CREATE INDEX IF NOT EXISTS idx_gravacoes_destino
    ON searchvideo.gravacoes (destino);

CREATE INDEX IF NOT EXISTS idx_gravacoes_cpf
    ON searchvideo.gravacoes (cpf);

CREATE INDEX IF NOT EXISTS idx_gravacoes_cnpj
    ON searchvideo.gravacoes (cnpj);

CREATE INDEX IF NOT EXISTS idx_gravacoes_protocolo
    ON searchvideo.gravacoes (protocolo);

CREATE INDEX IF NOT EXISTS idx_gravacoes_contrato
    ON searchvideo.gravacoes (contrato);

CREATE INDEX IF NOT EXISTS idx_logs_gravacao_data
    ON searchvideo.log_auditoria (gravacao_id, registrado_em DESC);

CREATE INDEX IF NOT EXISTS idx_logs_usuario_data
    ON searchvideo.log_auditoria (usuario_id, registrado_em DESC);
