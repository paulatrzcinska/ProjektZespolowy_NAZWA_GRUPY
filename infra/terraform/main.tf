terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "projekt-zespolowy-nazwa-grupy-tfstate"
    key          = "network/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "Terraform"
    }
  }
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# podsieci 3-tier: public-web, private-app, private-db (+ private-db-2 dla RDS)
resource "aws_subnet" "this" {
  for_each = var.subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = coalesce(each.value.az, var.availability_zone)
  map_public_ip_on_launch = each.value.public

  tags = {
    Name = each.key
    Tier = each.value.public ? "public" : "private"
  }
}

# routing: tylko podsieć publiczna ma trasę do Internetu
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "rt-public"
  }
}

# brak trasy 0.0.0.0/0 - ruch tylko wewnątrz VPC
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "rt-private"
  }
}

resource "aws_route_table_association" "this" {
  for_each = var.subnets

  subnet_id      = aws_subnet.this[each.key].id
  route_table_id = each.value.public ? aws_route_table.public.id : aws_route_table.private.id
}

# Security Groups: Internet -> web -> app -> db
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Web tier - HTTP/HTTPS z Internetu"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "web-sg"
  }
}

resource "aws_security_group" "app" {
  name        = "app-sg"
  description = "App tier - FastAPI tylko z warstwy web"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "app-sg"
  }
}

resource "aws_security_group" "db" {
  name        = "db-sg"
  description = "DB tier - PostgreSQL tylko z warstwy app"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "db-sg"
  }
}

# web: HTTP i HTTPS z Internetu
resource "aws_vpc_security_group_ingress_rule" "web_http" {
  security_group_id = aws_security_group.web.id
  description       = "HTTP z Internetu"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "web_https" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS z Internetu"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# app: port API tylko z web-sg
resource "aws_vpc_security_group_ingress_rule" "app_from_web" {
  security_group_id            = aws_security_group.app.id
  description                  = "FastAPI tylko z warstwy web"
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = var.app_port
  to_port                      = var.app_port
}

# db: PostgreSQL tylko z app-sg
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL tylko z warstwy app"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}

# ruch wychodzący: dozwolony dla warstw web i app
resource "aws_vpc_security_group_egress_rule" "all_out" {
  for_each = {
    web = aws_security_group.web.id
    app = aws_security_group.app.id
  }

  security_group_id = each.value
  description       = "Caly ruch wychodzacy"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# db: ruch wychodzący tylko do app-sg (jak w konsoli); odpowiedzi na zapytania
# przechodzą i tak, bo Security Groups są stanowe
resource "aws_vpc_security_group_egress_rule" "db_to_app" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = var.db_port
  to_port                      = var.db_port
}

# Baza danych: RDS PostgreSQL w podsieciach prywatnych, bez publicznego IP
resource "aws_db_subnet_group" "db" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Prywatne podsieci bazy danych (private-db, private-db-2)"
  subnet_ids  = [for name in var.db_subnets : aws_subnet.this[name].id]
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 0 # autoscaling wyłączony - stały koszt
  storage_type          = "gp3"
  storage_encrypted     = true # klucz aws/rds

  db_name  = "shop"
  username = "pgadmin"
  # hasło generuje i przechowuje AWS Secrets Manager - nigdy nie trafia do kodu
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false
  availability_zone      = var.availability_zone
  port                   = var.db_port

  backup_retention_period    = var.db_backup_retention_days
  copy_tags_to_snapshot      = true
  auto_minor_version_upgrade = true
  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${var.project_name}-db-final"

  database_insights_mode                = "standard"
  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # bezpłatne
}
