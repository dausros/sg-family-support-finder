# ----------------------------- General -------------------------------------

variable "region" {
  description = "AWS region. ap-southeast-1 (Singapore) by default."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Short project slug used in resource names."
  type        = string
  default     = "sgfsf-o11"
}

variable "extra_tags" {
  description = "Additional tags merged into the provider default_tags."
  type        = map(string)
  default     = {}
}

# ----------------------------- Network -------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the platform VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Two public subnet CIDRs (ALB, NAT gateways), one per AZ."
  type        = list(string)
  default     = ["10.20.0.0/24", "10.20.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly two public subnet CIDRs (one per AZ)."
  }
}

variable "private_app_subnet_cidrs" {
  description = "Two private app subnet CIDRs (front-ends, controllers, LifeTime, Amazon MQ)."
  type        = list(string)
  default     = ["10.20.10.0/23", "10.20.12.0/23"]

  validation {
    condition     = length(var.private_app_subnet_cidrs) == 2
    error_message = "Provide exactly two private app subnet CIDRs (one per AZ)."
  }
}

variable "private_db_subnet_cidrs" {
  description = "Two private DB subnet CIDRs (RDS), no internet route."
  type        = list(string)
  default     = ["10.20.20.0/24", "10.20.21.0/24"]

  validation {
    condition     = length(var.private_db_subnet_cidrs) == 2
    error_message = "Provide exactly two private DB subnet CIDRs (one per AZ)."
  }
}

variable "nat_gateway_per_az" {
  description = "true = one NAT gateway per AZ (HA, ~2x NAT cost). false = a single NAT gateway shared by both AZs (cheaper, AZ-level SPOF for egress)."
  type        = bool
  default     = true
}

variable "flow_logs_retention_days" {
  description = "Retention for VPC flow logs in CloudWatch."
  type        = number
  default     = 90
}

# ----------------------------- Edge ----------------------------------------

variable "alb_ingress_cidr_blocks" {
  description = "CIDRs allowed to reach the ALB on 80/443. Narrow this for non-public deployments."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "domain_name" {
  description = "Base domain. Environment hosts are <env>.<domain_name> (e.g. dev.o11.example.gov.sg) and LifeTime is lifetime.<domain_name>."
  type        = string
  default     = "o11.example.com"
}

variable "acm_certificate_arn" {
  description = "Existing ACM certificate ARN for the ALB (covering *.domain_name). Leave empty to have Terraform request one."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Optional public hosted zone ID. When set, Terraform creates ACM DNS-validation records and alias records for every environment host."
  type        = string
  default     = ""
}

variable "waf_rate_limit_per_5min" {
  description = "WAF rate-based rule: max requests per source IP per 5 minutes before blocking."
  type        = number
  default     = 2000
}

variable "health_check_path" {
  description = "ALB target-group health check path on the front-ends. Assumption: '/' served by IIS; replace with a lightweight app endpoint once the platform is installed."
  type        = string
  default     = "/"
}

# ----------------------------- Compute -------------------------------------

variable "windows_ami_name_filter" {
  description = "Name filter for the Amazon-owned Windows Server AMI used by every platform server. Check the OutSystems 11 system requirements for the supported versions of your Platform Server release."
  type        = string
  default     = "Windows_Server-2022-English-Full-Base-*"
}

variable "allowed_rdp_cidr_blocks" {
  description = "Optional CIDRs allowed to RDP (3389) to platform servers. Empty = no RDP rule; use SSM Session Manager instead."
  type        = list(string)
  default     = []
}

variable "dev_environment" {
  description = "Development environment sizing. See env/dev.tfvars.example."
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
  default = {
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

variable "test_environment" {
  description = "Test / Quality Assurance environment sizing. See env/test.tfvars.example."
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
  default = {
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

variable "prod_environment" {
  description = "Production environment sizing. See env/prod.tfvars.example."
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
  default = {
    enabled                  = true
    fe_instance_type         = "m6i.xlarge"
    fe_min                   = 2
    fe_max                   = 6
    fe_desired               = 2
    controller_instance_type = "m6i.xlarge"
    mq_instance_type         = "mq.m5.large"
    mq_deployment_mode       = "CLUSTER_MULTI_AZ"
  }
}

variable "lifetime" {
  description = "LifeTime management console: its own dedicated single-server environment."
  type = object({
    enabled       = bool
    instance_type = string
  })
  default = {
    enabled       = true
    instance_type = "m6i.large"
  }
}

# ----------------------------- Database ------------------------------------

variable "db_engine" {
  description = "RDS SQL Server edition. sqlserver-se = Standard Edition (license included)."
  type        = string
  default     = "sqlserver-se"
}

variable "db_engine_version" {
  description = "RDS SQL Server engine version. Must be a version the OutSystems 11 system requirements list for your Platform Server release (assumption: SQL Server 2019)."
  type        = string
  default     = "15.00"
}

variable "db_username" {
  description = "Master username for both RDS instances. The password is generated and held by RDS in Secrets Manager."
  type        = string
  default     = "o11admin"
}

variable "nonprod_db_instance_class" {
  description = "Instance class for the shared non-prod RDS instance (hosts the Dev, Test and LifeTime platform databases as separate catalogs)."
  type        = string
  default     = "db.m5.large"
}

variable "prod_db_instance_class" {
  description = "Instance class for the dedicated Multi-AZ production RDS instance."
  type        = string
  default     = "db.m5.xlarge"
}

variable "db_allocated_storage" {
  description = "Initial gp3 storage (GiB) per RDS instance."
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Storage autoscaling ceiling (GiB) per RDS instance."
  type        = number
  default     = 500
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention (point-in-time recovery window), separate from the AWS Backup plan."
  type        = number
  default     = 7
}

# ----------------------------- Operations ----------------------------------

variable "alarm_email" {
  description = "Optional email subscribed to the alarms SNS topic (confirmation required). Empty = topic only."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Retention for application / platform CloudWatch log groups."
  type        = number
  default     = 90
}

variable "backup_daily_retention_days" {
  description = "AWS Backup: retention for daily recovery points."
  type        = number
  default     = 35
}

variable "backup_monthly_retention_days" {
  description = "AWS Backup: retention for monthly recovery points (moved to cold storage after 30 days)."
  type        = number
  default     = 365
}
