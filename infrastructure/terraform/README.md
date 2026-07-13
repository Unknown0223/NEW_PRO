# SALEC infrastructure (Terraform)

Railway-specific IaC — PostgreSQL, Redis, backend/frontend servislar.

## Struktura

```
infrastructure/terraform/
  main.tf           # provider + modules
  variables.tf      # input variables
  outputs.tf        # connection strings (sensitive)
  modules/
    postgres/       # Railway Postgres plugin
    redis/          # Railway Redis plugin
    services/       # backend + frontend + worker
```

## Secret mapping

| Terraform output | Railway variable | GitHub Secret |
|------------------|------------------|---------------|
| `database_url` | `DATABASE_URL` | `STAGING_DATABASE_URL` |
| `redis_url` | `REDIS_URL` | — |
| `jwt_access_secret` | `JWT_ACCESS_SECRET` | `CI_JWT_ACCESS_SECRET` |

Batafsil: `docs/PROD_DEPLOY_YAKUNLANDI.md`.

## Ishlatish (reja)

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

> **Eslatma:** Railway provider hali `modules/services` da stub — haqiqiy deploy GitHub Actions + Railway CLI orqali.

## Environment parity

Dev/staging/prod bir xil Docker image (`backend/Dockerfile`, `Dockerfile.worker`).
Compose base: `infrastructure/docker-compose.yml`.
