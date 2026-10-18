# Offline unit tests for one OutSystems 11 environment (modules/o11_environment),
# run directly against the module with fake IDs. Same rules as
# platform.tftest.hcl: mock providers, `plan` only, no AWS account.

mock_provider "aws" {}
mock_provider "random" {}

variables {
  name_prefix            = "sgfsf-o11"
  environment            = "prod"
  region                 = "ap-southeast-1"
  vpc_id                 = "vpc-0123456789abcdef0"
  vpc_cidr               = "10.20.0.0/16"
  private_subnet_ids     = ["subnet-0aaaaaaaaaaaaaaaa", "subnet-0bbbbbbbbbbbbbbbb"]
  ami_id                 = "ami-0123456789abcdef0"
  instance_profile_name  = "sgfsf-o11-server"
  alb_security_group_id  = "sg-0a1b2c3d4e5f60718"
  alb_arn_suffix         = "app/sgfsf-o11-alb/0123456789abcdef"
  https_listener_arn     = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:listener/app/sgfsf-o11-alb/0123456789abcdef/0123456789abcdef"
  host_header            = "prod.o11.example.com"
  listener_rule_priority = 300
  health_check_path      = "/"

  lifetime_enabled           = true
  lifetime_security_group_id = "sg-0f1e2d3c4b5a69788"
  allowed_rdp_cidr_blocks    = []

  settings = {
    enabled                  = true
    fe_instance_type         = "m6i.xlarge"
    fe_min                   = 2
    fe_max                   = 6
    fe_desired               = 2
    controller_instance_type = "m6i.xlarge"
    mq_instance_type         = "mq.m5.large"
    mq_deployment_mode       = "CLUSTER_MULTI_AZ"
  }

  sns_topic_arn      = "arn:aws:sns:ap-southeast-1:123456789012:sgfsf-o11-alarms"
  log_retention_days = 365
  kms_key_arn        = "arn:aws:kms:ap-southeast-1:123456789012:key/00000000-0000-0000-0000-000000000000"
}

run "prod_environment" {
  command = plan

  module {
    source = "./modules/o11_environment"
  }

  # --- Front-end farm ------------------------------------------------------
  assert {
    condition     = aws_autoscaling_group.fe.min_size >= 2 && length(aws_autoscaling_group.fe.vpc_zone_identifier) == 2
    error_message = "Prod front-ends: at least 2 instances across both AZs."
  }
  assert {
    condition     = aws_autoscaling_group.fe.health_check_type == "ELB"
    error_message = "ASG must replace instances the ALB marks unhealthy."
  }
  assert {
    condition     = aws_launch_template.fe.metadata_options[0].http_tokens == "required"
    error_message = "Front-ends must enforce IMDSv2."
  }
  assert {
    condition     = one(aws_launch_template.fe.block_device_mappings).ebs[0].encrypted == "true"
    error_message = "Front-end root volumes must be encrypted."
  }
  assert {
    condition     = aws_lb_target_group.fe.stickiness[0].enabled == false
    error_message = "OutSystems advises against sticky sessions on farms; stickiness must be off."
  }
  assert {
    condition     = aws_lb_target_group.fe.health_check[0].enabled && aws_lb_listener_rule.fe.priority == 300
    error_message = "Target group needs a health check and the host rule its priority."
  }

  # --- Deployment Controller -------------------------------------------------
  assert {
    condition     = aws_instance.controller.metadata_options[0].http_tokens == "required" && aws_instance.controller.root_block_device[0].encrypted
    error_message = "Controller must enforce IMDSv2 and encrypt its root volume."
  }
  assert {
    condition     = aws_instance.controller.tags["Backup"] == "true" && aws_instance.controller.tags["Environment"] == "prod"
    error_message = "Controller must be tagged for AWS Backup and with its environment."
  }

  # --- OutSystems port matrix, nothing from the internet ---------------------
  assert {
    condition     = toset([for r in aws_vpc_security_group_ingress_rule.controller_from_fe : r.from_port]) == toset([12000, 12100])
    error_message = "Front-end -> Deployment Controller must be exactly 12000/12100."
  }
  assert {
    condition     = toset([for r in aws_vpc_security_group_ingress_rule.fe_from_controller : r.from_port]) == toset([80, 12001, 12101, 12002, 12102])
    error_message = "Deployment Controller -> front-end must be exactly 80, 12001/12101, 12002/12102."
  }
  assert {
    condition = alltrue(concat(
      [for r in aws_vpc_security_group_ingress_rule.controller_from_fe : r.cidr_ipv4 == null],
      [for r in aws_vpc_security_group_ingress_rule.fe_from_controller : r.cidr_ipv4 == null],
      [for r in aws_vpc_security_group_ingress_rule.fe_from_fe : r.cidr_ipv4 == null],
      [for r in aws_vpc_security_group_ingress_rule.mq_from_servers : r.cidr_ipv4 == null],
      [aws_vpc_security_group_ingress_rule.fe_http_from_alb.cidr_ipv4 == null]
    ))
    error_message = "Platform ports may only be opened to security groups, never to a CIDR."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.rdp) == 0
    error_message = "No RDP rule without admin CIDRs."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.fe_from_lifetime) == 2 && length(aws_vpc_security_group_ingress_rule.controller_from_lifetime) == 2
    error_message = "LifeTime must reach front-ends and controller on 80/443."
  }
  assert {
    condition     = alltrue([for r in aws_vpc_security_group_ingress_rule.mq_from_servers : r.from_port == 5671])
    error_message = "RabbitMQ is reachable only on AMQPS 5671."
  }

  # --- Cache invalidation (Amazon MQ for RabbitMQ) ---------------------------
  assert {
    condition     = aws_mq_broker.cache.engine_type == "RabbitMQ" && aws_mq_broker.cache.publicly_accessible == false
    error_message = "Cache invalidation broker must be private RabbitMQ."
  }
  assert {
    condition     = aws_mq_broker.cache.deployment_mode == "CLUSTER_MULTI_AZ" && length(aws_mq_broker.cache.subnet_ids) == 2
    error_message = "Prod broker must be a Multi-AZ cluster across both subnets."
  }
  assert {
    condition     = aws_mq_broker.cache.encryption_options[0].use_aws_owned_key == false
    error_message = "Broker must be encrypted with the platform CMK."
  }

  # --- Logs and alarms -------------------------------------------------------
  assert {
    condition     = length(aws_cloudwatch_log_group.this) == 3 && alltrue([for g in aws_cloudwatch_log_group.this : g.retention_in_days == 365 && g.kms_key_id != null])
    error_message = "IIS, platform and Windows event log groups, encrypted, with the given retention."
  }
  assert {
    condition = alltrue([for a in [
      aws_cloudwatch_metric_alarm.fe_cpu_high, aws_cloudwatch_metric_alarm.fe_unhealthy, aws_cloudwatch_metric_alarm.fe_5xx,
      aws_cloudwatch_metric_alarm.fe_latency, aws_cloudwatch_metric_alarm.controller_cpu_high,
      aws_cloudwatch_metric_alarm.controller_status, aws_cloudwatch_metric_alarm.mq_cpu
    ] : contains(a.alarm_actions, var.sns_topic_arn)])
    error_message = "All 7 environment alarms must notify the SNS topic."
  }
  assert {
    condition     = contains(aws_cloudwatch_metric_alarm.controller_status.alarm_actions, "arn:aws:automate:ap-southeast-1:ec2:recover")
    error_message = "Controller status alarm must auto-recover the instance."
  }
}

run "dev_environment_single_broker_with_rdp" {
  command = plan

  module {
    source = "./modules/o11_environment"
  }

  variables {
    environment             = "dev"
    host_header             = "dev.o11.example.com"
    listener_rule_priority  = 100
    allowed_rdp_cidr_blocks = ["10.99.0.0/24"]
    lifetime_enabled        = false
    settings = {
      enabled                  = true
      fe_instance_type         = "m6i.large"
      fe_min                   = 1
      fe_max                   = 2
      fe_desired               = 1
      controller_instance_type = "m6i.large"
      mq_instance_type         = "mq.t3.micro"
      mq_deployment_mode       = "SINGLE_INSTANCE"
    }
  }

  assert {
    condition     = length(aws_mq_broker.cache.subnet_ids) == 1
    error_message = "A SINGLE_INSTANCE broker takes exactly one subnet."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.rdp) == 2 && alltrue([for r in aws_vpc_security_group_ingress_rule.rdp : r.cidr_ipv4 == "10.99.0.0/24" && r.from_port == 3389])
    error_message = "RDP opens only to the admin CIDR, on front-end and controller."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.fe_from_lifetime) == 0
    error_message = "No LifeTime rules when LifeTime is disabled."
  }
}
