terraform {
  required_version = ">= 1.5.0"
  required_providers {
    # Railway provider — kelajakda to'liq ulash; hozir dokumentatsiya va stub.
    # railway = { source = "terraform-community-providers/railway", version = "~> 0.4" }
  }
}

# module "postgres" {
#   source = "./modules/postgres"
#   environment = var.environment
# }

# module "redis" {
#   source = "./modules/redis"
#   environment = var.environment
# }

# module "services" {
#   source      = "./modules/services"
#   environment = var.environment
#   database_url = module.postgres.url
#   redis_url    = module.redis.url
# }
