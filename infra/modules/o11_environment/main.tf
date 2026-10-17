# One OutSystems 11 environment (Dev, Test or Prod):
#   - front-end farm (Windows/IIS) in an Auto Scaling group behind the shared ALB
#   - a dedicated Deployment Controller server (stateful, single instance)
#   - Amazon MQ for RabbitMQ as the environment's cache invalidation service
#   - security groups following the OutSystems 11 network requirements
#   - CloudWatch log groups, CloudWatch agent config and alarms -> SNS
#
# It provisions the AWS landing zone only. Installing and licensing the
# OutSystems Platform Server on these hosts is a manual step (see README).

locals {
  name = "${var.name_prefix}-${var.environment}"

  # Short name for resources with tight length limits (target groups: 32 chars).
  short_name = substr(local.name, 0, 24)

  tags = {
    Environment = var.environment
  }
}

# ===================== Security groups =====================================

resource "aws_security_group" "fe" {
  name        = "${local.name}-sg-frontend"
  description = "OutSystems front-ends (${var.environment})"
  vpc_id      = var.vpc_id
  tags        = merge(local.tags, { Name = "${local.name}-sg-frontend" })
}

resource "aws_security_group" "controller" {
  name        = "${local.name}-sg-controller"
  description = "OutSystems Deployment Controller (${var.environment})"
  vpc_id      = var.vpc_id
  tags        = merge(local.tags, { Name = "${local.name}-sg-controller" })
}

resource "aws_security_group" "mq" {
  name        = "${local.name}-sg-mq"
  description = "Amazon MQ RabbitMQ cache invalidation (${var.environment})"
  vpc_id      = var.vpc_id
  tags        = merge(local.tags, { Name = "${local.name}-sg-mq" })
}

locals {
  # Ports from "OutSystems 11 network requirements" (success.outsystems.com).
  # 12000/12100: Deployment Controller service (12100 on Platform Server >= 11.25)
  # 12001/12101: Deployment service on each front-end (12101 on >= 11.24)
  # 12002/12102: Scheduler service monitoring (12102 on >= 11.21)
  fe_to_controller_ports = [12000, 12100]
  controller_to_fe_ports = [80, 12001, 12101, 12002, 12102]
  fe_to_fe_ports         = [80, 12001, 12101, 12002, 12102]

  # LifeTime talks to each environment over HTTP(S) (assumption: direct to the
  # front-ends and controller inside the VPC rather than via the public ALB).
  lifetime_ports = var.lifetime_security_group_id == "" ? [] : [80, 443]
}

# ALB -> front-ends (TLS terminates on the ALB).
resource "aws_vpc_security_group_ingress_rule" "fe_http_from_alb" {
  security_group_id            = aws_security_group.fe.id
  description                  = "HTTP from the ALB"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = var.alb_security_group_id
}

resource "aws_vpc_security_group_ingress_rule" "fe_from_controller" {
  for_each                     = toset([for p in local.controller_to_fe_ports : tostring(p)])
  security_group_id            = aws_security_group.fe.id
  description                  = "Deployment Controller to front-end, port ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  referenced_security_group_id = aws_security_group.controller.id
}

resource "aws_vpc_security_group_ingress_rule" "fe_from_fe" {
  for_each                     = toset([for p in local.fe_to_fe_ports : tostring(p)])
  security_group_id            = aws_security_group.fe.id
  description                  = "Front-end to front-end monitoring, port ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  referenced_security_group_id = aws_security_group.fe.id
}

resource "aws_vpc_security_group_ingress_rule" "controller_from_fe" {
  for_each                     = toset([for p in local.fe_to_controller_ports : tostring(p)])
  security_group_id            = aws_security_group.controller.id
  description                  = "Front-end to Deployment Controller service, port ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  referenced_security_group_id = aws_security_group.fe.id
}

resource "aws_vpc_security_group_ingress_rule" "fe_from_lifetime" {
  for_each                     = toset([for p in local.lifetime_ports : tostring(p)])
  security_group_id            = aws_security_group.fe.id
  description                  = "LifeTime to front-ends, port ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  referenced_security_group_id = var.lifetime_security_group_id
}

resource "aws_vpc_security_group_ingress_rule" "controller_from_lifetime" {
  for_each                     = toset([for p in local.lifetime_ports : tostring(p)])
  security_group_id            = aws_security_group.controller.id
  description                  = "LifeTime to Deployment Controller, port ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  referenced_security_group_id = var.lifetime_security_group_id
}

# Amazon MQ for RabbitMQ only accepts AMQP over TLS (5671).
resource "aws_vpc_security_group_ingress_rule" "mq_from_servers" {
  for_each = {
    frontend   = aws_security_group.fe.id
    controller = aws_security_group.controller.id
  }
  security_group_id            = aws_security_group.mq.id
  description                  = "AMQPS 5671 from ${each.key}"
  ip_protocol                  = "tcp"
  from_port                    = 5671
  to_port                      = 5671
  referenced_security_group_id = each.value
}

resource "aws_vpc_security_group_ingress_rule" "rdp" {
  for_each = {
    for pair in setproduct(["fe", "controller"], var.allowed_rdp_cidr_blocks) :
    "${pair[0]}-${pair[1]}" => { sg = pair[0], cidr = pair[1] }
  }
  security_group_id = each.value.sg == "fe" ? aws_security_group.fe.id : aws_security_group.controller.id
  description       = "Restricted RDP"
  ip_protocol       = "tcp"
  from_port         = 3389
  to_port           = 3389
  cidr_ipv4         = each.value.cidr
}

# Egress: anything inside the VPC (DB, MQ, peers), plus HTTPS/HTTP for
# OS updates, data.gov.sg and OutSystems licensing/services, and SMTP
# submission (587) for Amazon SES.
locals {
  server_sgs = {
    fe         = aws_security_group.fe.id
    controller = aws_security_group.controller.id
  }
  internet_egress_ports = ["80", "443", "587"]
  internet_egress = {
    for pair in setproduct(keys(local.server_sgs), local.internet_egress_ports) :
    "${pair[0]}-${pair[1]}" => { sg = pair[0], port = pair[1] }
  }
}

resource "aws_vpc_security_group_egress_rule" "servers_vpc" {
  for_each          = local.server_sgs
  security_group_id = each.value
  description       = "All traffic inside the VPC"
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_vpc_security_group_egress_rule" "servers_internet" {
  for_each          = local.internet_egress
  security_group_id = local.server_sgs[each.value.sg]
  description       = "Outbound TCP ${each.value.port} via NAT"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value.port)
  to_port           = tonumber(each.value.port)
  cidr_ipv4         = "0.0.0.0/0"
}

# ===================== Logging =============================================

resource "aws_cloudwatch_log_group" "this" {
  for_each          = toset(["iis", "platform", "windows-events"])
  name              = "/${var.name_prefix}/${var.environment}/${each.value}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
  tags              = local.tags
}

# CloudWatch agent config, fetched by user data on every platform server.
# The OutSystems log path is an assumption (default install directory).
resource "aws_ssm_parameter" "cw_agent" {
  name = "/${var.name_prefix}/${var.environment}/cloudwatch-agent-config"
  type = "String"
  tags = local.tags
  value = jsonencode({
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            {
              file_path       = "C:\\inetpub\\logs\\LogFiles\\W3SVC1\\*.log"
              log_group_name  = aws_cloudwatch_log_group.this["iis"].name
              log_stream_name = "{instance_id}"
            },
            {
              file_path       = "C:\\Program Files\\OutSystems\\Platform Server\\logs\\*.log"
              log_group_name  = aws_cloudwatch_log_group.this["platform"].name
              log_stream_name = "{instance_id}"
            }
          ]
        }
        windows_events = {
          collect_list = [
            {
              event_name      = "Application"
              event_levels    = ["ERROR", "WARNING"]
              log_group_name  = aws_cloudwatch_log_group.this["windows-events"].name
              log_stream_name = "{instance_id}"
            },
            {
              event_name      = "System"
              event_levels    = ["ERROR", "WARNING"]
              log_group_name  = aws_cloudwatch_log_group.this["windows-events"].name
              log_stream_name = "{instance_id}"
            }
          ]
        }
      }
    }
    metrics = {
      namespace = "${var.name_prefix}/${var.environment}"
      append_dimensions = {
        AutoScalingGroupName = "$${aws:AutoScalingGroupName}"
        InstanceId           = "$${aws:InstanceId}"
      }
      metrics_collected = {
        Memory      = { measurement = ["% Committed Bytes In Use"] }
        LogicalDisk = { measurement = ["% Free Space"], resources = ["*"] }
      }
    }
  })
}

locals {
  user_data = {
    for role in ["frontend", "controller"] : role => base64encode(templatefile("${path.module}/user_data.ps1.tftpl", {
      role         = role
      environment  = var.environment
      cw_param     = aws_ssm_parameter.cw_agent.name
      mq_endpoints = join(",", aws_mq_broker.cache.instances[*].endpoints[0])
    }))
  }
}

# ===================== Front-end farm ======================================

resource "aws_lb_target_group" "fe" {
  name                 = "${local.short_name}-fe"
  port                 = 80
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "instance"
  deregistration_delay = 60

  # OutSystems keeps sessions in the session database and advises against
  # sticky sessions on web farms (Recommended configurations for load balancing).
  stickiness {
    type    = "lb_cookie"
    enabled = false
  }

  health_check {
    enabled             = true
    path                = var.health_check_path
    matcher             = "200-399"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  tags = local.tags
}

resource "aws_lb_listener_rule" "fe" {
  listener_arn = var.https_listener_arn
  priority     = var.listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fe.arn
  }

  condition {
    host_header {
      values = [var.host_header]
    }
  }

  tags = local.tags
}

resource "aws_launch_template" "fe" {
  name_prefix   = "${local.name}-fe-"
  image_id      = var.ami_id
  instance_type = var.settings.fe_instance_type
  user_data     = local.user_data["frontend"]
  ebs_optimized = true

  iam_instance_profile {
    name = var.instance_profile_name
  }

  vpc_security_group_ids = [aws_security_group.fe.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true
  }

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 100
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.tags, { Name = "${local.name}-frontend", Role = "o11-frontend" })
  }

  tag_specifications {
    resource_type = "volume"
    tags          = merge(local.tags, { Name = "${local.name}-frontend", Role = "o11-frontend" })
  }

  tags = local.tags
}

resource "aws_autoscaling_group" "fe" {
  name                      = "${local.name}-fe"
  min_size                  = var.settings.fe_min
  max_size                  = var.settings.fe_max
  desired_capacity          = var.settings.fe_desired
  vpc_zone_identifier       = var.private_subnet_ids
  target_group_arns         = [aws_lb_target_group.fe.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 1200 # Windows boot + Platform Server warm-up
  default_cooldown          = 600
  enabled_metrics           = ["GroupInServiceInstances", "GroupDesiredCapacity"]

  launch_template {
    id      = aws_launch_template.fe.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }

  lifecycle {
    ignore_changes = [desired_capacity]
  }
}

resource "aws_autoscaling_policy" "fe_cpu" {
  name                   = "${local.name}-fe-cpu-target"
  autoscaling_group_name = aws_autoscaling_group.fe.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60
  }
}

# ===================== Deployment Controller ===============================
# Single stateful server per environment (compiles and deploys apps to the
# front-ends). A plain EC2 instance keeps a stable private IP/hostname that
# the front-ends register against; AWS Backup snapshots it (Backup=true) and
# an EC2 auto-recover alarm handles host failure.

resource "aws_instance" "controller" {
  ami                    = var.ami_id
  instance_type          = var.settings.controller_instance_type
  subnet_id              = var.private_subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.controller.id]
  iam_instance_profile   = var.instance_profile_name
  user_data_base64       = local.user_data["controller"]
  ebs_optimized          = true
  monitoring             = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 150
    volume_type = "gp3"
    encrypted   = true
  }

  tags = merge(local.tags, {
    Name   = "${local.name}-deployment-controller"
    Role   = "o11-deployment-controller"
    Backup = "true"
  })

  lifecycle {
    ignore_changes = [ami, user_data_base64]
  }
}

# ===================== Cache invalidation (Amazon MQ) ======================

resource "random_password" "mq" {
  length  = 32
  special = false # Amazon MQ forbids , : = in broker passwords
}

resource "aws_secretsmanager_secret" "mq" {
  name        = "${var.name_prefix}/${var.environment}/rabbitmq"
  description = "Amazon MQ RabbitMQ credentials for the ${var.environment} cache invalidation service"
  kms_key_id  = var.kms_key_arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "mq" {
  secret_id = aws_secretsmanager_secret.mq.id
  secret_string = jsonencode({
    username = "o11cache"
    password = random_password.mq.result
  })
}

resource "aws_mq_broker" "cache" {
  broker_name                = "${local.name}-cache"
  engine_type                = "RabbitMQ"
  engine_version             = "3.13"
  host_instance_type         = var.settings.mq_instance_type
  deployment_mode            = var.settings.mq_deployment_mode
  publicly_accessible        = false
  auto_minor_version_upgrade = true
  security_groups            = [aws_security_group.mq.id]

  # SINGLE_INSTANCE takes exactly one subnet; CLUSTER_MULTI_AZ spans both AZs.
  subnet_ids = var.settings.mq_deployment_mode == "SINGLE_INSTANCE" ? [var.private_subnet_ids[0]] : var.private_subnet_ids

  user {
    username = "o11cache"
    password = random_password.mq.result
  }

  encryption_options {
    kms_key_id        = var.kms_key_arn
    use_aws_owned_key = false
  }

  logs {
    general = true
  }

  maintenance_window_start_time {
    day_of_week = "SUNDAY"
    time_of_day = "18:00" # 02:00 SGT
    time_zone   = "UTC"
  }

  tags = local.tags
}

# ===================== Alarms -> SNS =======================================

resource "aws_cloudwatch_metric_alarm" "fe_cpu_high" {
  alarm_name          = "${local.name}-fe-cpu-high"
  alarm_description   = "Front-end ASG average CPU > 80% for 15 min"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { AutoScalingGroupName = aws_autoscaling_group.fe.name }
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "fe_unhealthy" {
  alarm_name          = "${local.name}-fe-unhealthy-hosts"
  alarm_description   = "At least one front-end failing ALB health checks for 5 min"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = aws_lb_target_group.fe.arn_suffix
  }
  alarm_actions = [var.sns_topic_arn]
  ok_actions    = [var.sns_topic_arn]
  tags          = local.tags
}

resource "aws_cloudwatch_metric_alarm" "fe_5xx" {
  alarm_name          = "${local.name}-fe-target-5xx"
  alarm_description   = "Front-ends returning > 10 HTTP 5xx per minute for 5 min"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = aws_lb_target_group.fe.arn_suffix
  }
  alarm_actions = [var.sns_topic_arn]
  tags          = local.tags
}

resource "aws_cloudwatch_metric_alarm" "fe_latency" {
  alarm_name          = "${local.name}-fe-latency-p95"
  alarm_description   = "p95 target response time > 3 s for 10 min"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 2
  threshold           = 3
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = aws_lb_target_group.fe.arn_suffix
  }
  alarm_actions = [var.sns_topic_arn]
  tags          = local.tags
}

resource "aws_cloudwatch_metric_alarm" "controller_cpu_high" {
  alarm_name          = "${local.name}-controller-cpu-high"
  alarm_description   = "Deployment Controller CPU > 90% for 30 min (sustained compilation or runaway process)"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 6
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.controller.id }
  alarm_actions       = [var.sns_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "controller_status" {
  alarm_name          = "${local.name}-controller-system-check"
  alarm_description   = "Deployment Controller failed the EC2 system status check: auto-recover and notify"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.controller.id }
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover", var.sns_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "mq_cpu" {
  alarm_name          = "${local.name}-mq-cpu-high"
  alarm_description   = "RabbitMQ broker CPU > 80% for 15 min"
  namespace           = "AWS/AmazonMQ"
  metric_name         = "SystemCpuUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { Broker = aws_mq_broker.cache.broker_name }
  alarm_actions       = [var.sns_topic_arn]
  tags                = local.tags
}
