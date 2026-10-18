# Dev / Test / Prod: one module instance per enabled environment. Each gets
# its own front-end ASG + target group (host-based routing on the shared
# HTTPS listener), Deployment Controller, Amazon MQ broker, security groups,
# log groups and alarms.

locals {
  listener_priority = { dev = 100, test = 200, prod = 300 }
}

module "environment" {
  source   = "./modules/o11_environment"
  for_each = local.environments

  name_prefix = local.name_prefix
  environment = each.key
  region      = var.region
  settings    = each.value

  vpc_id             = aws_vpc.main.id
  vpc_cidr           = var.vpc_cidr
  private_subnet_ids = aws_subnet.private_app[*].id

  ami_id                = data.aws_ami.windows.id
  instance_profile_name = aws_iam_instance_profile.server.name

  alb_security_group_id  = aws_security_group.alb.id
  alb_arn_suffix         = aws_lb.main.arn_suffix
  https_listener_arn     = aws_lb_listener.https.arn
  host_header            = local.hosts[each.key]
  listener_rule_priority = local.listener_priority[each.key]
  health_check_path      = var.health_check_path

  lifetime_enabled           = var.lifetime.enabled
  lifetime_security_group_id = var.lifetime.enabled ? aws_security_group.lifetime[0].id : ""
  allowed_rdp_cidr_blocks    = var.allowed_rdp_cidr_blocks

  kms_key_arn        = aws_kms_key.platform.arn
  sns_topic_arn      = aws_sns_topic.alarms.arn
  log_retention_days = var.log_retention_days
}
