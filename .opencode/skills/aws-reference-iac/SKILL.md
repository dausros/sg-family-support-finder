---
name: aws-reference-iac
description: Use for designing, writing, and validating minimal Terraform AWS reference infrastructure for a self-managed OutSystems 11 platform assessment.
---

# aws-reference-iac

1. Treat this as a reference design, not infrastructure for the existing personal environment.
2. Document VPC/subnets, security groups, load balancing, Windows/IIS compute, SQL Server, secrets and monitoring; verify OutSystems deployment prerequisites against official documentation.
3. Avoid claiming generic AWS resources install or configure OutSystems Platform Server, licensing, or LifeTime.
4. Parameterise region, network ranges and resource sizes; do not embed secrets.
5. Run terraform fmt and validate where available; never terraform apply without explicit approval. Report unverified/deferred aspects.
