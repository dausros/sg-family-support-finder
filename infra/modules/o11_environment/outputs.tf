output "frontend_security_group_id" {
  description = "Front-end security group."
  value       = aws_security_group.fe.id
}

output "controller_security_group_id" {
  description = "Deployment Controller security group."
  value       = aws_security_group.controller.id
}

output "frontend_asg_name" {
  description = "Front-end Auto Scaling group."
  value       = aws_autoscaling_group.fe.name
}

output "frontend_target_group_arn" {
  description = "Front-end target group."
  value       = aws_lb_target_group.fe.arn
}

output "controller_instance_id" {
  description = "Deployment Controller instance ID."
  value       = aws_instance.controller.id
}

output "controller_private_ip" {
  description = "Deployment Controller private IP (front-ends register against it)."
  value       = aws_instance.controller.private_ip
}

output "mq_amqps_endpoints" {
  description = "Amazon MQ AMQPS endpoint(s) for the cache invalidation service."
  value       = aws_mq_broker.cache.instances[*].endpoints[0]
}

output "mq_secret_arn" {
  description = "Secrets Manager secret holding the RabbitMQ credentials."
  value       = aws_secretsmanager_secret.mq.arn
}

output "log_group_names" {
  description = "CloudWatch log groups for this environment."
  value       = [for g in aws_cloudwatch_log_group.this : g.name]
}
