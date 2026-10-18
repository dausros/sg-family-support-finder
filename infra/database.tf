# RDS for SQL Server.
#   nonprod: one single-AZ instance hosting the Dev, Test and LifeTime
#            platform databases as separate catalogs (cost trade-off).
#   prod:    a dedicated Multi-AZ instance (synchronous standby, automatic
#            failover).
# Assumption: RDS for SQL Server is acceptable to the OutSystems Platform
# Server (it needs a SQL Server login with the documented permissions;
# RDS does not grant sysadmin). See README "Assumptions".

locals {
  db_tiers = merge(
    length([for k in keys(local.environments) : k if k != "prod"]) > 0 || var.lifetime.enabled ? {
      nonprod = { instance_class = var.nonprod_db_instance_class, multi_az = false }
    } : {},
    contains(keys(local.environments), "prod") ? {
      prod = { instance_class = var.prod_db_instance_class, multi_az = true }
    } : {}
  )
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.private_db[*].id
  tags       = { Name = "${local.name_prefix}-db" }
}

resource "aws_security_group" "db" {
  for_each    = local.db_tiers
  name        = "${local.name_prefix}-${each.key}-sg-db"
  description = "SQL Server (${each.key}): 1433 from that tier's platform servers only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name_prefix}-${each.key}-sg-db" }
}

locals {
  # Which server SGs may reach which DB tier.
  db_ingress = merge(
    merge([
      for env, m in module.environment : {
        "${env}-fe" = {
          tier = local.env_db_tier[env]
          sg   = m.frontend_security_group_id
        }
        "${env}-controller" = {
          tier = local.env_db_tier[env]
          sg   = m.controller_security_group_id
        }
      }
    ]...),
    var.lifetime.enabled ? {
      lifetime = { tier = "nonprod", sg = aws_security_group.lifetime[0].id }
    } : {}
  )
}

resource "aws_vpc_security_group_ingress_rule" "db" {
  for_each                     = local.db_ingress
  security_group_id            = aws_security_group.db[each.value.tier].id
  description                  = "SQL Server from ${each.key}"
  ip_protocol                  = "tcp"
  from_port                    = 1433
  to_port                      = 1433
  referenced_security_group_id = each.value.sg
}

resource "aws_db_instance" "platform" {
  #checkov:skip=CKV_AWS_157:Only the shared non-prod instance is single-AZ (cost trade-off). Prod is Multi-AZ, asserted by tests/platform.tftest.hcl.
  for_each = local.db_tiers

  identifier     = "${local.name_prefix}-${each.key}-mssql"
  engine         = var.db_engine
  engine_version = var.db_engine_version
  license_model  = "license-included"
  instance_class = each.value.instance_class
  multi_az       = each.value.multi_az

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.platform.arn

  username                    = var.db_username
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db[each.key].id]
  publicly_accessible    = false

  backup_retention_period         = var.db_backup_retention_days
  backup_window                   = "17:00-18:00" # 01:00-02:00 SGT
  maintenance_window              = "sun:18:30-sun:19:30"
  copy_tags_to_snapshot           = true
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name_prefix}-${each.key}-mssql-final"
  auto_minor_version_upgrade      = true
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.platform.arn
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = ["error", "agent"]

  tags = {
    Name   = "${local.name_prefix}-${each.key}-mssql"
    Tier   = each.key
    Backup = "true"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  for_each            = local.db_tiers
  alarm_name          = "${local.name_prefix}-${each.key}-rds-cpu-high"
  alarm_description   = "RDS ${each.key} CPU > 80% for 15 min"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.platform[each.key].identifier }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  for_each            = local.db_tiers
  alarm_name          = "${local.name_prefix}-${each.key}-rds-free-storage-low"
  alarm_description   = "RDS ${each.key} free storage < 10 GiB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 10737418240
  comparison_operator = "LessThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.platform[each.key].identifier }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_memory" {
  for_each            = local.db_tiers
  alarm_name          = "${local.name_prefix}-${each.key}-rds-freeable-memory-low"
  alarm_description   = "RDS ${each.key} freeable memory < 512 MiB for 15 min"
  namespace           = "AWS/RDS"
  metric_name         = "FreeableMemory"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 536870912
  comparison_operator = "LessThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.platform[each.key].identifier }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name_prefix}-rds-enhanced-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
