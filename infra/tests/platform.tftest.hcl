# Offline unit tests for the root configuration.
#
#   cd infra && terraform init -backend=false && terraform test
#
# mock_provider means no AWS account, credentials or network calls are needed:
# every run is a `plan` against fake providers, and the assertions check the
# planned configuration. What this proves: the security and resilience
# settings below are present and wired as intended. What it does not prove:
# that AWS accepts the plan (quotas, engine versions, instance availability).
# That needs a real `terraform plan`, which has not been run (no AWS account).

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
  mock_data "aws_elb_service_account" {
    defaults = {
      arn = "arn:aws:iam::114774131450:root"
    }
  }
  mock_data "aws_ami" {
    defaults = {
      id = "ami-0123456789abcdef0"
    }
  }
}

mock_provider "random" {}

# ---------------------------------------------------------------------------
# Defaults: Dev + Test + Prod + LifeTime
# ---------------------------------------------------------------------------
run "defaults" {
  command = plan

  # --- Network: two AZs, three tiers --------------------------------------
  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private_app) == 2 && length(aws_subnet.private_db) == 2
    error_message = "Expected 2 public, 2 private-app and 2 private-db subnets."
  }
  assert {
    condition     = aws_subnet.private_db[0].availability_zone != aws_subnet.private_db[1].availability_zone && aws_subnet.private_app[0].availability_zone != aws_subnet.private_app[1].availability_zone
    error_message = "Each tier must span two different Availability Zones."
  }
  assert {
    condition     = output.nat_gateway_count == 2
    error_message = "Default should be one NAT gateway per AZ."
  }
  assert {
    condition     = length(aws_flow_log.vpc.traffic_type) > 0 && aws_flow_log.vpc.traffic_type == "ALL"
    error_message = "VPC flow logs must capture ALL traffic."
  }

  # --- Database: SQL Server, encrypted, private, Multi-AZ in prod ---------
  assert {
    condition     = toset(keys(aws_db_instance.platform)) == toset(["nonprod", "prod"])
    error_message = "Expected a shared non-prod and a dedicated prod RDS instance."
  }
  assert {
    condition     = aws_db_instance.platform["prod"].multi_az == true
    error_message = "Production RDS must be Multi-AZ."
  }
  assert {
    condition     = alltrue([for k, db in aws_db_instance.platform : startswith(db.engine, "sqlserver")])
    error_message = "OutSystems 11 platform DB is SQL Server here."
  }
  assert {
    condition     = alltrue([for k, db in aws_db_instance.platform : db.storage_encrypted && !db.publicly_accessible])
    error_message = "Every RDS instance must be encrypted at rest and not publicly accessible."
  }
  assert {
    condition     = alltrue([for k, db in aws_db_instance.platform : db.backup_retention_period >= 7 && db.deletion_protection && !db.skip_final_snapshot])
    error_message = "RDS needs >= 7 days PITR, deletion protection and a final snapshot."
  }
  assert {
    condition     = alltrue([for k, db in aws_db_instance.platform : db.manage_master_user_password == true])
    error_message = "The master password must be generated and held by RDS in Secrets Manager, not in Terraform."
  }
  assert {
    condition     = alltrue([for k, db in aws_db_instance.platform : db.tags["Backup"] == "true"])
    error_message = "RDS instances must carry Backup=true so the AWS Backup selection picks them up."
  }

  # --- No world-open SQL Server or RDP -------------------------------------
  assert {
    condition     = alltrue([for k, r in aws_vpc_security_group_ingress_rule.db : r.from_port == 1433 && r.to_port == 1433 && r.cidr_ipv4 == null && r.cidr_ipv6 == null])
    error_message = "SQL Server (1433) may only be reached from platform security groups, never from a CIDR."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.lifetime_rdp) == 0
    error_message = "With no admin CIDRs given, no RDP rule may exist."
  }
  assert {
    condition     = alltrue([for k, r in aws_vpc_security_group_ingress_rule.alb : contains([80, 443], r.from_port)])
    error_message = "The public ALB may only accept 80 and 443."
  }

  # --- Edge: HTTPS with TLS 1.2+, HTTP redirects, WAF ---------------------
  assert {
    condition     = aws_lb_listener.https.protocol == "HTTPS" && aws_lb_listener.https.port == 443
    error_message = "The ALB must have an HTTPS listener on 443."
  }
  assert {
    condition     = contains(["ELBSecurityPolicy-TLS13-1-2-2021-06", "ELBSecurityPolicy-TLS13-1-2-Res-2021-06", "ELBSecurityPolicy-TLS13-1-3-2021-06"], aws_lb_listener.https.ssl_policy)
    error_message = "The HTTPS listener must use a TLS 1.2+ (TLS 1.3 capable) policy."
  }
  assert {
    condition     = aws_lb_listener.http_redirect.default_action[0].type == "redirect" && aws_lb_listener.http_redirect.default_action[0].redirect[0].protocol == "HTTPS" && aws_lb_listener.http_redirect.default_action[0].redirect[0].status_code == "HTTP_301"
    error_message = "Port 80 must 301-redirect to HTTPS."
  }
  assert {
    condition     = aws_lb.main.drop_invalid_header_fields && aws_lb.main.enable_deletion_protection && aws_lb.main.access_logs[0].enabled
    error_message = "ALB must drop invalid headers, have deletion protection and access logs."
  }
  assert {
    condition = alltrue([for n in ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet", "AWSManagedRulesSQLiRuleSet", "AWSManagedRulesWindowsRuleSet", "AWSManagedRulesAmazonIpReputationList", "AWSManagedRulesAnonymousIpList", "RateLimitPerIp"] :
    contains([for r in aws_wafv2_web_acl.main.rule : r.name], n)])
    error_message = "WAF is missing one of the expected rules."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.alb_logs.block_public_acls && aws_s3_bucket_public_access_block.alb_logs.block_public_policy && aws_s3_bucket_public_access_block.alb_logs.restrict_public_buckets
    error_message = "ALB log bucket must block all public access."
  }

  # --- Encryption, logs, alarms, backups -----------------------------------
  assert {
    condition     = aws_kms_key.platform.enable_key_rotation
    error_message = "The platform KMS key must rotate."
  }
  assert {
    condition     = aws_cloudwatch_log_group.vpc_flow.retention_in_days >= 365 && aws_cloudwatch_log_group.waf.retention_in_days >= 365 && alltrue([for k, g in aws_cloudwatch_log_group.lifetime : g.retention_in_days >= 365])
    error_message = "Log groups must keep at least a year by default."
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.rds_cpu) == 2 && length(aws_cloudwatch_metric_alarm.rds_storage) == 2 && length(aws_cloudwatch_metric_alarm.rds_memory) == 2
    error_message = "CPU, storage and memory alarms must exist for each RDS instance."
  }
  assert {
    condition     = aws_cloudwatch_metric_alarm.alb_5xx.alarm_name != "" && aws_cloudwatch_metric_alarm.backup_failed.alarm_name != "" && aws_cloudwatch_metric_alarm.lifetime_status[0].alarm_name != ""
    error_message = "ALB 5xx, backup-failure and LifeTime status alarms must exist."
  }
  assert {
    condition     = alltrue([for r in aws_backup_plan.main.rule : r.lifecycle[0].delete_after >= 35])
    error_message = "AWS Backup must keep recovery points >= 35 days."
  }
  assert {
    condition     = one(aws_backup_selection.tagged.selection_tag).key == "Backup" && one(aws_backup_selection.tagged.selection_tag).value == "true"
    error_message = "AWS Backup must select resources tagged Backup=true."
  }

  # --- Environments and LifeTime -------------------------------------------
  assert {
    condition     = toset(keys(output.environment_hosts)) == toset(["dev", "test", "prod", "lifetime"])
    error_message = "Dev, Test, Prod and a dedicated LifeTime host are expected."
  }
  assert {
    condition     = aws_instance.lifetime[0].metadata_options[0].http_tokens == "required" && aws_instance.lifetime[0].root_block_device[0].encrypted
    error_message = "LifeTime server must enforce IMDSv2 and encrypt its root volume."
  }
}

# ---------------------------------------------------------------------------
# Cost-saving toggles still plan and keep prod-only guarantees out
# ---------------------------------------------------------------------------
run "single_nat_and_no_prod" {
  command = plan

  variables {
    nat_gateway_per_az = false
    prod_environment = {
      enabled                  = false
      fe_instance_type         = "m6i.xlarge"
      fe_min                   = 2
      fe_max                   = 6
      fe_desired               = 2
      controller_instance_type = "m6i.xlarge"
      mq_instance_type         = "mq.m5.large"
      mq_deployment_mode       = "CLUSTER_MULTI_AZ"
    }
  }

  assert {
    condition     = output.nat_gateway_count == 1
    error_message = "nat_gateway_per_az = false should create one NAT gateway."
  }
  assert {
    condition     = toset(keys(aws_db_instance.platform)) == toset(["nonprod"])
    error_message = "Without prod, only the non-prod RDS instance should exist."
  }
  assert {
    condition     = !contains(keys(output.environment_hosts), "prod")
    error_message = "No prod host when prod is disabled."
  }
}

# ---------------------------------------------------------------------------
# Restricted RDP is allowed, and only from the given CIDR
# ---------------------------------------------------------------------------
run "restricted_rdp" {
  command = plan

  variables {
    allowed_rdp_cidr_blocks = ["10.99.0.0/24"]
  }

  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.lifetime_rdp) == 1 && alltrue([for r in aws_vpc_security_group_ingress_rule.lifetime_rdp : r.cidr_ipv4 == "10.99.0.0/24" && r.from_port == 3389])
    error_message = "RDP must be opened only to the given admin CIDR."
  }
}

# ---------------------------------------------------------------------------
# Guard rails: inputs that must be rejected
# ---------------------------------------------------------------------------
run "reject_rdp_from_internet" {
  command = plan
  variables {
    allowed_rdp_cidr_blocks = ["0.0.0.0/0"]
  }
  expect_failures = [var.allowed_rdp_cidr_blocks]
}

run "reject_short_db_backup_retention" {
  command = plan
  variables {
    db_backup_retention_days = 3
  }
  expect_failures = [var.db_backup_retention_days]
}

run "reject_invalid_log_retention" {
  command = plan
  variables {
    log_retention_days = 100
  }
  expect_failures = [var.log_retention_days]
}

run "reject_single_az" {
  command = plan
  variables {
    availability_zones = ["ap-southeast-1a", "ap-southeast-1a"]
  }
  expect_failures = [var.availability_zones]
}

run "reject_az_outside_region" {
  command = plan
  variables {
    availability_zones = ["us-east-1a", "us-east-1b"]
  }
  expect_failures = [aws_vpc.main]
}
