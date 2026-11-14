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

# Wartości dla GitHub Actions (Settings -> Secrets and variables -> Actions -> Variables)
output "public_url" {
  description = "Publiczny adres aplikacji (CloudFront): frontend oraz /api, /health"
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "github_deploy_role_arn" {
  description = "ARN roli przyjmowanej przez GitHub Actions (AWS_DEPLOY_ROLE_ARN)"
  value       = aws_iam_role.github_deploy.arn
}

output "web_bucket" {
  description = "Bucket S3 z buildem frontendu (WEB_BUCKET)"
  value       = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  description = "ID dystrybucji CloudFront do unieważniania cache (CLOUDFRONT_DISTRIBUTION_ID)"
  value       = aws_cloudfront_distribution.web.id
}

output "ecr_repository" {
  description = "Nazwa repozytorium ECR obrazu backendu (ECR_REPOSITORY)"
  value       = aws_ecr_repository.api.name
}

output "ecs_cluster" {
  description = "Nazwa klastra ECS (ECS_CLUSTER)"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service" {
  description = "Nazwa usługi ECS backendu (ECS_SERVICE)"
  value       = aws_ecs_service.api.name
}

output "api_secret_arn" {
  description = "ARN sekretu z hasłami bazy i JWT_SECRET - wartości uzupełnia się ręcznie"
  value       = aws_secretsmanager_secret.api.arn
}
