# ---------------------------------------------------------------------------
# SG Family Support Finder — OutSystems 11 self-managed REFERENCE architecture
#
# This file provisions generic AWS infrastructure ONLY. It does NOT install,
# configure, license, or operate the OutSystems Platform Server / LifeTime.
# See infra/README.md for the provisioned vs. not-provisioned boundary.
# ---------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "${var.project}-${var.environment}"
  # Use the first two available AZs so subnets spread across 2 AZs.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# ----------------------------- VPC -----------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

# ----------------------------- Subnets -------------------------------------

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_subnet" "private_app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-app-${local.azs[count.index]}"
    Tier = "private-app"
  }
}

resource "aws_subnet" "private_db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_db_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-db-${local.azs[count.index]}"
    Tier = "private-db"
  }
}

# ------------------------- NAT + route tables ------------------------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${local.name_prefix}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rt-public"
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rt-private-app"
  }
}

resource "aws_route" "private_app_nat" {
  route_table_id         = aws_route_table.private_app.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}

resource "aws_route_table_association" "private_app" {
  count          = 2
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app.id
}

# DB subnets keep the VPC-local default route only (no internet egress).
resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-rt-private-db"
  }
}

resource "aws_route_table_association" "private_db" {
  count          = 2
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db.id
}

# --------------------------- Security groups -------------------------------

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-sg-alb"
  description = "ALB ingress from the internet, egress to app hosts."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-sg-alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  count             = length(var.alb_ingress_cidr_blocks)
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from allowed CIDRs"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = var.alb_ingress_cidr_blocks[count.index]
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  count             = length(var.alb_ingress_cidr_blocks)
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from allowed CIDRs"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = var.alb_ingress_cidr_blocks[count.index]
}

resource "aws_vpc_security_group_egress_rule" "alb_out" {
  security_group_id = aws_security_group.alb.id
  description       = "ALB to app hosts in the VPC"
  ip_protocol       = "-1"
  cidr_ipv4         = var.vpc_cidr
}

resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-sg-app"
  description = "Windows/IIS app hosts: HTTP from ALB, RDP optionally restricted."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-sg-app"
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_http_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "HTTP from ALB"
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "app_https_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "HTTPS from ALB"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "app_out" {
  security_group_id = aws_security_group.app.id
  description       = "App egress (updates, DB, Secrets Manager via NAT/VPC endpoints)"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# Optional, restricted RDP rule — only created when CIDRs are supplied.
resource "aws_vpc_security_group_ingress_rule" "app_rdp" {
  count             = length(var.allowed_rdp_cidr_blocks)
  security_group_id = aws_security_group.app.id
  description       = "Restricted RDP for break-glass (prefer SSM Session Manager)"
  ip_protocol       = "tcp"
  from_port         = 3389
  to_port           = 3389
  cidr_ipv4         = var.allowed_rdp_cidr_blocks[count.index]
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-sg-db"
  description = "RDS SQL Server: SQL traffic from app hosts only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-sg-db"
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_mssql_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "MSSQL from app hosts"
  ip_protocol                  = "tcp"
  from_port                    = 1433
  to_port                      = 1433
  referenced_security_group_id = aws_security_group.app.id
}

# No egress rule on the DB security group: deny-by-default. RDS returns
# traffic via stateful rules and initiates no outbound connections here.

# --------------------- S3 access-logs bucket (ALB) -------------------------

resource "aws_s3_bucket" "alb_logs" {
  bucket_prefix = "${local.name_prefix}-alb-logs-"
  force_destroy = false

  tags = {
    Name = "${local.name_prefix}-alb-logs"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = data.aws_elb_service_account.main.arn }
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.alb_logs.arn}/*"
    }]
  })
}

# ------------------------------- ALB ---------------------------------------

resource "aws_lb" "app" {
  name               = "${substr(local.name_prefix, 0, 24)}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    enabled = true
  }

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  name     = "${substr(local.name_prefix, 0, 24)}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
    matcher             = "200-399"
  }

  tags = {
    Name = "${local.name_prefix}-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ------------------- IAM role / instance profile ---------------------------
# SSM + CloudWatch agent access. No secrets embedded; Secrets Manager read
# is granted so hosts can fetch DB credentials at install/runtime.

resource "aws_iam_role" "app" {
  name = "${local.name_prefix}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "${local.name_prefix}-app-role"
  }
}

resource "aws_iam_role_policy_attachment" "app_ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "app_cloudwatch" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy" "app_secrets" {
  name = "${local.name_prefix}-read-db-secret"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      # Placeholder secret plus the RDS-managed master-user secret created by
      # manage_master_user_password (the actual live credential when enabled).
      Resource = [
        aws_secretsmanager_secret.db_credentials.arn,
        aws_db_instance.mssql.master_user_secret[0].secret_arn,
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.name_prefix}-app-profile"
  role = aws_iam_role.app.name

  tags = {
    Name = "${local.name_prefix}-app-profile"
  }
}

# ------------------ Windows Server / IIS app hosts -------------------------

data "aws_ami" "windows_2019" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Windows_Server-2019-English-Full-Base-*"]
  }
}

resource "aws_launch_template" "app" {
  name_prefix   = "${local.name_prefix}-app-"
  image_id      = data.aws_ami.windows_2019.id
  instance_type = var.app_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.app.id]
  }

  metadata_options {
    http_tokens = "required" # enforce IMDSv2
  }

  # Placeholder user data: installs IIS only. OutSystems Platform Server
  # installation and configuration are manual/prerequisite steps (see README).
  user_data = base64encode(<<-EOF
    <powershell>
    Install-WindowsFeature -Name Web-Server -IncludeManagementTools
    </powershell>
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${local.name_prefix}-app-host"
    }
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${local.name_prefix}-app-asg"
  min_size            = var.app_min_size
  max_size            = var.app_max_size
  desired_capacity    = var.app_desired_capacity
  vpc_zone_identifier = [for s in aws_subnet.private_app : s.id]
  target_group_arns   = [aws_lb_target_group.app.arn]

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-app-host"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------ Secrets Manager placeholder (DB creds) ------------------
# No password is hardcoded. The secret value must be set out-of-band
# (console/CLI/rotation) after apply; RDS uses manage_master_user_password.

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}/rds-master-credentials"
  description             = "Placeholder for RDS SQL Server master credentials. Set the secret value out-of-band; never commit secrets."
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-db-credentials"
  }
}

# ---------------------- RDS SQL Server -------------------------------------

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-dbsubnet"
  subnet_ids = [for s in aws_subnet.private_db : s.id]

  tags = {
    Name = "${local.name_prefix}-dbsubnet"
  }
}

resource "aws_db_instance" "mssql" {
  identifier                = "${local.name_prefix}-mssql"
  engine                    = "sqlserver-se"
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.db.id]
  multi_az                  = var.db_multi_az
  backup_retention_period   = var.db_backup_retention_days
  storage_encrypted         = true
  copy_tags_to_snapshot     = true
  delete_automated_backups  = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-mssql-final"

  # Credentials managed by RDS; username parameterised, password auto-managed.
  username                    = var.db_username
  manage_master_user_password = true

  tags = {
    Name = "${local.name_prefix}-mssql"
  }
}

# ------------------- CloudWatch monitoring / alarms ------------------------

resource "aws_cloudwatch_metric_alarm" "asg_cpu_high" {
  alarm_name          = "${local.name_prefix}-asg-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "App host fleet average CPU above 80% for 10 minutes."

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  tags = {
    Name = "${local.name_prefix}-asg-cpu-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS SQL Server CPU above 80% for 10 minutes."

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.mssql.identifier
  }

  tags = {
    Name = "${local.name_prefix}-rds-cpu-high"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${local.name_prefix}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GiB in bytes
  alarm_description   = "RDS SQL Server free storage below 10 GiB."

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.mssql.identifier
  }

  tags = {
    Name = "${local.name_prefix}-rds-storage-low"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_high" {
  alarm_name          = "${local.name_prefix}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "ALB target 5xx count above 50 in 5 minutes."

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-alb-5xx-high"
  }
}
