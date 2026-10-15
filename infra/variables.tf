variable "region" {
  description = "AWS region for the reference architecture."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project name used in resource names and tags."
  type        = string
  default     = "sg-family-support-finder"
}

variable "environment" {
  description = "Environment label (e.g. dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets (ALB / NAT)."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly 2 public subnet CIDRs (one per AZ)."
  }
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for the two private app subnets (Windows/IIS hosts)."
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]

  validation {
    condition     = length(var.private_app_subnet_cidrs) == 2
    error_message = "Provide exactly 2 private app subnet CIDRs (one per AZ)."
  }
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for the two private DB subnets (RDS SQL Server)."
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24"]

  validation {
    condition     = length(var.private_db_subnet_cidrs) == 2
    error_message = "Provide exactly 2 private DB subnet CIDRs (one per AZ)."
  }
}

variable "alb_ingress_cidr_blocks" {
  description = "CIDR blocks allowed to reach the ALB on HTTP/HTTPS. Restrict in production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "app_instance_type" {
  description = "EC2 instance type for Windows Server / IIS app hosts."
  type        = string
  default     = "t3.large"
}

variable "app_min_size" {
  description = "Minimum number of app hosts in the Auto Scaling group."
  type        = number
  default     = 1
}

variable "app_max_size" {
  description = "Maximum number of app hosts in the Auto Scaling group."
  type        = number
  default     = 2
}

variable "app_desired_capacity" {
  description = "Desired number of app hosts in the Auto Scaling group."
  type        = number
  default     = 1
}

variable "db_instance_class" {
  description = "RDS instance class for SQL Server."
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage (GB) for RDS SQL Server."
  type        = number
  default     = 100
}

variable "db_username" {
  description = "Master username for RDS SQL Server. Password is NOT stored here; manage via Secrets Manager."
  type        = string
  default     = "o11admin"
}

variable "db_multi_az" {
  description = "Whether RDS SQL Server is Multi-AZ."
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention in days."
  type        = number
  default     = 7
}

variable "allowed_rdp_cidr_blocks" {
  description = "CIDR blocks allowed for RDP (3389) to app hosts. Leave empty to deny RDP. Prefer SSM Session Manager."
  type        = list(string)
  default     = []
}

variable "extra_tags" {
  description = "Additional tags merged into every resource via provider default_tags."
  type        = map(string)
  default     = {}
}
