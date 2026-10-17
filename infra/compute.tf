# Shared IAM role / AMI for every platform server (front-ends, Deployment
# Controllers, LifeTime).

data "aws_ami" "windows" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = [var.windows_ami_name_filter]
  }
}

resource "aws_iam_role" "server" {
  name = "${local.name_prefix}-platform-server"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "server_ssm" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "server_cloudwatch" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Least privilege: read only this project's secrets (RDS-managed master
# secrets and the RabbitMQ secrets) and CloudWatch agent parameters.
resource "aws_iam_role_policy" "server_secrets" {
  name = "read-platform-secrets"
  role = aws_iam_role.server.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadSecrets"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = concat(
          [for db in aws_db_instance.platform : db.master_user_secret[0].secret_arn],
          [for e in module.environment : e.mq_secret_arn]
        )
      },
      {
        Sid      = "DecryptPlatformKey"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.platform.arn
      },
      {
        Sid      = "ReadAgentConfig"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${local.name_prefix}/*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "server" {
  name = "${local.name_prefix}-platform-server"
  role = aws_iam_role.server.name
}
