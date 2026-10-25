output "vpc_id" {
  description = "ID sieci VPC"
  value       = aws_vpc.main.id
}

output "subnet_ids" {
  description = "ID podsieci (public-web, private-app, private-db, private-db-2)"
  value       = { for name, subnet in aws_subnet.this : name => subnet.id }
}

output "security_group_ids" {
  description = "ID grup zabezpieczeń"
  value = {
    web = aws_security_group.web.id
    app = aws_security_group.app.id
    db  = aws_security_group.db.id
  }
}

output "internet_gateway_id" {
  description = "ID Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "db_endpoint" {
  description = "Adres bazy RDS (DB_HOST backendu), dostępny tylko z wnętrza VPC"
  value       = aws_db_instance.main.address
}

output "db_master_secret_arn" {
  description = "ARN sekretu z hasłem administratora RDS w Secrets Manager"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
