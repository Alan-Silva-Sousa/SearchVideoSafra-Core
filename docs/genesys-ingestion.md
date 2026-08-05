# Pipeline Genesys da Safra

O compose mantém a aplicação normal independente dos serviços de ingestão.

## Metadados

O profile `ingestion` inicia o PostgreSQL canônico e o extrator em modo
`METADATA_ONLY`. Por padrão, o serviço aguarda o cron e não consulta a Genesys
imediatamente ao subir.

```bash
sudo docker compose --profile ingestion up -d --build ingestion-postgres genesys-metadata
```

## Piloto S3

Antes do piloto, configure `EXPORT_PILOT_START` e `EXPORT_PILOT_END`. A janela
deve ter no máximo uma hora. O serviço consulta apenas as filas explicitamente
configuradas, usa o Batch Download da Genesys e transmite o conteúdo ao S3.

```bash
sudo docker compose --profile export run --rm genesys-s3-export
```

O profile `export` não deve ser incluído no `docker compose up` cotidiano.
