variable "name_prefix" {
  description = "Project prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Environment key (dev, test, prod)."
  type        = string
}

variable "region" {
  description = "AWS region (used in the EC2 recover alarm action ARN)."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR (intra-VPC egress)."
  type        = string
}

variable "private_subnet_ids" {
  description = "Two private app subnet IDs in different AZs."
  type        = list(string)
}

variable "ami_id" {
  description = "Windows Server AMI ID for front-ends and the Deployment Controller."
  type        = string
}

variable "instance_profile_name" {
  description = "IAM instance profile attached to every platform server."
  type        = string
}

variable "alb_security_group_id" {
  description = "Security group of the shared ALB (allowed to reach front-ends on 80)."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix (CloudWatch dimensions)."
  type        = string
}

variable "https_listener_arn" {
  description = "Shared HTTPS listener to attach the host-based routing rule to."
  type        = string
}

variable "host_header" {
  description = "Host name routed to this environment's front-ends (e.g. prod.o11.example.com)."
  type        = string
}

variable "listener_rule_priority" {
  description = "Unique priority of this environment's listener rule."
  type        = number
}

variable "health_check_path" {
  description = "Target group health check path."
  type        = string
}

variable "lifetime_enabled" {
  description = "Whether a LifeTime server exists. A plain bool (known at plan time) so the LifeTime rules' for_each never depends on an ID that is only known after apply."
  type        = bool
  default     = false
}

variable "lifetime_security_group_id" {
  description = "LifeTime server SG allowed to reach this environment's servers. Used only when lifetime_enabled = true."
  type        = string
  default     = ""
}

variable "allowed_rdp_cidr_blocks" {
  description = "Optional RDP source CIDRs."
  type        = list(string)
  default     = []
}

variable "settings" {
  description = "Sizing for this environment."
  type = object({
    enabled                  = bool
    fe_instance_type         = string
    fe_min                   = number
    fe_max                   = number
    fe_desired               = number
    controller_instance_type = string
    mq_instance_type         = string
    mq_deployment_mode       = string
  })
}

variable "sns_topic_arn" {
  description = "SNS topic every alarm notifies."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key for logs, secrets and the broker."
  type        = string
}
