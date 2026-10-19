output "vpc_id" {
  description = "Dedicated project VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public Web subnets for the internet-facing ALB, keyed by zone."
  value       = { for key, subnet in aws_subnet.public : key => subnet.id }
}

output "app_subnet_ids" {
  description = "Private subnets for ECS tasks with assign_public_ip=false."
  value       = { for key, subnet in aws_subnet.app : key => subnet.id }
}

output "database_subnet_ids" {
  description = "Isolated subnets for an RDS DB subnet group with publicly_accessible=false."
  value       = { for key, subnet in aws_subnet.database : key => subnet.id }
}

output "security_group_ids" {
  description = "Attach each security group only to its corresponding application tier."
  value = {
    web      = aws_security_group.web.id
    app      = aws_security_group.app.id
    database = aws_security_group.database.id
  }
}

output "subnet_cidrs" {
  description = "Address plan for documentation and review."
  value = {
    public   = local.public_cidrs
    app      = local.app_cidrs
    database = local.database_cidrs
  }
}

output "nat_gateway_enabled" {
  description = "Whether the paid NAT Gateway and private App default routes are enabled."
  value       = var.enable_nat_gateway
}
