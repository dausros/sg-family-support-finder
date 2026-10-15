output "vpc_id" {
  description = "ID of the reference VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (ALB / NAT)."
  value       = [for s in aws_subnet.public : s.id]
}

output "private_app_subnet_ids" {
  description = "IDs of the private app subnets (Windows/IIS hosts)."
  value       = [for s in aws_subnet.private_app : s.id]
}

output "private_db_subnet_ids" {
  description = "IDs of the private DB subnets (RDS)."
  value       = [for s in aws_subnet.private_db : s.id]
}

output "alb_dns_name" {
  description = "DNS name of the application load balancer."
  value       = aws_lb.app.dns_name
}

output "alb_arn_suffix" {
  description = "ARN suffix of the ALB (used by CloudWatch dimensions)."
  value       = aws_lb.app.arn_suffix
}

output "asg_name" {
  description = "Name of the app-host Auto Scaling group."
  value       = aws_autoscaling_group.app.name
}

output "rds_endpoint" {
  description = "Endpoint of the RDS SQL Server instance."
  value       = aws_db_instance.mssql.endpoint
}

output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager placeholder for DB credentials."
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "alb_logs_bucket" {
  description = "S3 bucket receiving ALB access logs."
  value       = aws_s3_bucket.alb_logs.id
}
