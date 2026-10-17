# AWS Backup for the stateful pieces: Deployment Controllers, LifeTime and
# both RDS instances (selected by tag Backup=true). Front-ends are stateless
# (rebuilt by the ASG and redeployed by the controller) and are not backed up.
# RDS automated backups (PITR) still run alongside this plan.

resource "aws_backup_vault" "main" {
  name        = "${local.name_prefix}-vault"
  kms_key_arn = aws_kms_key.platform.arn
}

resource "aws_backup_plan" "main" {
  name = "${local.name_prefix}-plan"

  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 18 * * ? *)" # 02:00 SGT
    start_window      = 60
    completion_window = 360

    lifecycle {
      delete_after = var.backup_daily_retention_days
    }
  }

  rule {
    rule_name         = "monthly"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 19 1 * ? *)"
    start_window      = 60
    completion_window = 720

    lifecycle {
      cold_storage_after = 30
      delete_after       = var.backup_monthly_retention_days
    }
  }
}

resource "aws_iam_role" "backup" {
  name = "${local.name_prefix}-backup"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  for_each = toset([
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup",
    "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores",
  ])
  role       = aws_iam_role.backup.name
  policy_arn = each.value
}

resource "aws_backup_selection" "tagged" {
  name         = "${local.name_prefix}-tagged"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn

  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}

resource "aws_cloudwatch_metric_alarm" "backup_failed" {
  alarm_name          = "${local.name_prefix}-backup-jobs-failed"
  alarm_description   = "One or more AWS Backup jobs failed in the last day"
  namespace           = "AWS/Backup"
  metric_name         = "NumberOfBackupJobsFailed"
  statistic           = "Sum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { BackupVaultName = aws_backup_vault.main.name }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}
