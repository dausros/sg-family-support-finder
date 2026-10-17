data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = var.project
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)

  # Every enabled OutSystems environment (Dev / Test / Prod). LifeTime is
  # handled separately because it must run in its own dedicated environment.
  all_environments = {
    dev  = var.dev_environment
    test = var.test_environment
    prod = var.prod_environment
  }
  environments = { for k, v in local.all_environments : k => v if v.enabled }

  # Non-prod environments share one RDS instance; prod gets its own Multi-AZ one.
  env_db_tier = { for k, _ in local.environments : k => (k == "prod" ? "prod" : "nonprod") }

  hosts = merge(
    { for k, _ in local.environments : k => "${k}.${var.domain_name}" },
    var.lifetime.enabled ? { lifetime = "lifetime.${var.domain_name}" } : {}
  )

  create_certificate = var.acm_certificate_arn == ""
  use_route53        = var.route53_zone_id != ""
}
