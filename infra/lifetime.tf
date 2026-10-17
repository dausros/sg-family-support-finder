# LifeTime: the infrastructure management console. OutSystems 11 requires it
# to run in its own dedicated environment ("Installing LifeTime in an existing
# environment is not supported from version OutSystems 11 onwards").
# Modelled as one combined front-end + controller server.
# Assumption: it uses the RabbitMQ bundled with its own Platform Server
# install for cache invalidation (no separate broker), and its platform
# database lives on the shared non-prod RDS instance.

resource "aws_security_group" "lifetime" {
  count       = var.lifetime.enabled ? 1 : 0
  name        = "${local.name_prefix}-lifetime-sg"
  description = "OutSystems LifeTime server"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name_prefix}-lifetime-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "lifetime_from_alb" {
  count                        = var.lifetime.enabled ? 1 : 0
  security_group_id            = aws_security_group.lifetime[0].id
  description                  = "HTTP from the ALB"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "lifetime_vpc" {
  count             = var.lifetime.enabled ? 1 : 0
  security_group_id = aws_security_group.lifetime[0].id
  description       = "All traffic inside the VPC (environments, RDS)"
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_vpc_security_group_egress_rule" "lifetime_https" {
  count             = var.lifetime.enabled ? 1 : 0
  security_group_id = aws_security_group.lifetime[0].id
  description       = "HTTPS via NAT (updates, OutSystems services)"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "lifetime_rdp" {
  for_each          = var.lifetime.enabled ? toset(var.allowed_rdp_cidr_blocks) : toset([])
  security_group_id = aws_security_group.lifetime[0].id
  description       = "Restricted RDP"
  ip_protocol       = "tcp"
  from_port         = 3389
  to_port           = 3389
  cidr_ipv4         = each.value
}

resource "aws_cloudwatch_log_group" "lifetime" {
  for_each          = var.lifetime.enabled ? toset(["iis", "platform", "windows-events"]) : toset([])
  name              = "/${local.name_prefix}/lifetime/${each.value}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.platform.arn
}

resource "aws_instance" "lifetime" {
  count                  = var.lifetime.enabled ? 1 : 0
  ami                    = data.aws_ami.windows.id
  instance_type          = var.lifetime.instance_type
  subnet_id              = aws_subnet.private_app[1].id
  vpc_security_group_ids = [aws_security_group.lifetime[0].id]
  iam_instance_profile   = aws_iam_instance_profile.server.name
  ebs_optimized          = true
  monitoring             = true

  user_data_base64 = base64encode(<<-EOT
    <powershell>
    # Placeholder: prepares Windows/IIS for a LifeTime install. Does NOT install OutSystems.
    Install-WindowsFeature -Name Web-Server, Web-Asp-Net45, Web-Mgmt-Console, NET-Framework-45-Core -IncludeManagementTools
    </powershell>
  EOT
  )

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 150
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name        = "${local.name_prefix}-lifetime"
    Role        = "o11-lifetime"
    Environment = "lifetime"
    Backup      = "true"
  }

  lifecycle {
    ignore_changes = [ami, user_data_base64]
  }
}

resource "aws_lb_target_group" "lifetime" {
  count       = var.lifetime.enabled ? 1 : 0
  name        = "${substr(local.name_prefix, 0, 20)}-lifetime"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    path    = var.health_check_path
    matcher = "200-399"
  }
}

resource "aws_lb_target_group_attachment" "lifetime" {
  count            = var.lifetime.enabled ? 1 : 0
  target_group_arn = aws_lb_target_group.lifetime[0].arn
  target_id        = aws_instance.lifetime[0].id
  port             = 80
}

resource "aws_lb_listener_rule" "lifetime" {
  count        = var.lifetime.enabled ? 1 : 0
  listener_arn = aws_lb_listener.https.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lifetime[0].arn
  }

  condition {
    host_header {
      values = [local.hosts["lifetime"]]
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "lifetime_status" {
  count               = var.lifetime.enabled ? 1 : 0
  alarm_name          = "${local.name_prefix}-lifetime-system-check"
  alarm_description   = "LifeTime failed the EC2 system status check: auto-recover and notify"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.lifetime[0].id }
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover", aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "lifetime_cpu" {
  count               = var.lifetime.enabled ? 1 : 0
  alarm_name          = "${local.name_prefix}-lifetime-cpu-high"
  alarm_description   = "LifeTime CPU > 85% for 15 min"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { InstanceId = aws_instance.lifetime[0].id }
  alarm_actions       = [aws_sns_topic.alarms.arn]
}
