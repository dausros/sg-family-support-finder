output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "nat_gateway_count" {
  description = "NAT gateways created (2 when nat_gateway_per_az = true)."
  value       = length(aws_nat_gateway.main)
}

output "alb_dns_name" {
  description = "Public DNS name of the shared ALB (CNAME/alias target)."
  value       = aws_lb.main.dns_name
}

output "environment_hosts" {
  description = "Host name routed to each environment (and LifeTime)."
  value       = local.hosts
}

output "environments" {
  description = "Per-environment resources a platform administrator needs for the Platform Server install."
  value = {
    for k, m in module.environment : k => {
      frontend_asg          = m.frontend_asg_name
      controller_private_ip = m.controller_private_ip
      mq_amqps_endpoints    = m.mq_amqps_endpoints
      mq_secret_arn         = m.mq_secret_arn
      db_endpoint           = aws_db_instance.platform[local.env_db_tier[k]].address
      log_groups            = m.log_group_names
    }
  }
}

output "lifetime_private_ip" {
  description = "LifeTime server private IP (null when disabled)."
  value       = var.lifetime.enabled ? aws_instance.lifetime[0].private_ip : null
}

output "rds_endpoints" {
  description = "RDS endpoint per tier (nonprod / prod)."
  value       = { for k, db in aws_db_instance.platform : k => db.address }
}

output "rds_master_secret_arns" {
  description = "RDS-managed master credential secrets (no password is ever in Terraform)."
  value       = { for k, db in aws_db_instance.platform : k => db.master_user_secret[0].secret_arn }
}

output "acm_validation_records" {
  description = "DNS records to create manually when Terraform requested the certificate and route53_zone_id is empty."
  value = local.create_certificate && !local.use_route53 ? [
    for dvo in aws_acm_certificate.main[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ] : []
}

output "alarms_sns_topic_arn" {
  description = "SNS topic wired to every alarm."
  value       = aws_sns_topic.alarms.arn
}

output "waf_web_acl_arn" {
  description = "WAFv2 web ACL attached to the ALB."
  value       = aws_wafv2_web_acl.main.arn
}

output "backup_plan_id" {
  description = "AWS Backup plan for controllers, LifeTime and RDS."
  value       = aws_backup_plan.main.id
}
