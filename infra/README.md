# infra — OutSystems 11 self-managed REFERENCE architecture (AWS)

Minimal Terraform reference design for running a self-managed OutSystems 11
platform on AWS. It provisions **generic AWS infrastructure only**.

## What Terraform DOES provision

- VPC (`var.vpc_cidr`) with public, private-app, and private-db subnets
  spread across **2 AZs**, plus Internet Gateway, single NAT Gateway + EIP,
  and public / private-app / private-db route tables.
- Security groups:
  - `sg-alb` — HTTP/HTTPS ingress from `var.alb_ingress_cidr_blocks`,
    egress scoped to the VPC CIDR (to reach app targets).
  - `sg-app` — HTTP/HTTPS ingress **from the ALB SG only**; optional
    restricted RDP rule only when `var.allowed_rdp_cidr_blocks` is non-empty.
  - `sg-db` — TCP 1433 ingress **from the app SG only**, no egress rule
    (deny-by-default; return traffic is stateful).
- Application Load Balancer with HTTP listener, target group (health check
  `/`, matcher 200–399), and S3 access-logging bucket (private, versioned,
  SSE-AES256).
- Windows Server 2019 app hosts via launch template (IIS feature install in
  user data as a placeholder, IMDSv2 enforced) fronted by an Auto Scaling
  group in the private-app subnets, registered to the ALB target group.
- IAM role + instance profile for app hosts (SSM Core, CloudWatch agent,
  least-privilege read of the DB-credentials secret and the RDS-managed
  master-user secret).
- RDS SQL Server (`sqlserver-se`, encrypted, Multi-AZ configurable,
  automated backups, deletion protection) in the private-db subnets.
- Secrets Manager **placeholder secret** for DB credentials
  (`<project>-<env>/rds-master-credentials`). No password is hardcoded or
  committed. Because RDS uses `manage_master_user_password`, the live master
  credential lives in the RDS-managed secret, whose ARN the app role is also
  permitted to read; the placeholder value must be set/rotated out-of-band
  only if operationally used.
- CloudWatch alarms: ASG CPU high, RDS CPU high, RDS free-storage low,
  ALB target-5xx high. (No SNS topic is wired; attach notification actions
  per environment.)

All sizing, CIDRs, region, and DB settings are parameterised in
`variables.tf`. No secrets are hardcoded. Tags flow through the provider
`default_tags` block plus `var.extra_tags`.

## What Terraform does NOT implement

Terraform does **not** install, license, configure, or operate OutSystems.
The following are manual / contractual prerequisites outside this design:

- OutSystems Platform Server installation and configuration on the Windows
  hosts (this repo only installs the IIS role as a placeholder).
- OutSystems licensing (activation codes, user/CPU licensing).
- LifeTime / deployment controller setup, environment registration, and
  solution deployment.
- OutSystems-specific database schema creation, platform upgrades, patching
  runbooks, monitoring dashboards beyond the generic CloudWatch alarms above,
  backup/restore testing, HA/failover validation, and operational SOPs.
- TLS certificate issuance/attachment (the ALB ships with an HTTP listener
  only — add an ACM certificate + HTTPS listener per environment), DNS,
  WAF, VPN/Direct Connect, and any hardening beyond the baseline SGs.
- Setting/rotating actual secret values in Secrets Manager.

Do not present `terraform apply` output as an OutSystems deployment. It is
only the AWS landing zone on which a qualified OutSystems administrator
would subsequently install and license the platform per official OutSystems
documentation.

## Usage

```powershell
cd infra
terraform init
terraform fmt -check -recursive
terraform validate
# Review only — do not apply without explicit approval:
terraform plan
```

`terraform apply` is **out of scope** for this assessment and must never run
without explicit user approval (it incurs AWS costs).

## Validation

- `terraform fmt -check -recursive` — must pass (or record as deferred).
- `terraform validate` — must pass after `terraform init` (or record as
  deferred with reason).
- Never commit `.terraform/`, `*.tfstate`, or `*.tfvars` containing secrets.
