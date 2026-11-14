variable "aws_region" {
  description = "Region AWS projektu (w nowym trybie AWS przypisany automatycznie)"
  type        = string
  default     = "eu-north-1"
}

variable "availability_zone" {
  description = "Domyślna strefa dostępności dla podsieci i bazy danych"
  type        = string
  default     = "eu-north-1a"
}

variable "project_name" {
  description = "Prefiks nazw zasobów"
  type        = string
  default     = "pz"
}

variable "vpc_cidr" {
  description = "Pula adresów sieci VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnets" {
  description = "Podsieci architektury 3-tier"
  type = map(object({
    cidr   = string
    public = bool
    az     = optional(string) # domyślnie var.availability_zone
  }))
  default = {
    "public-web"  = { cidr = "10.0.1.0/24", public = true }
    "private-app" = { cidr = "10.0.2.0/24", public = false }
    "private-db"  = { cidr = "10.0.3.0/24", public = false }
    # RDS wymaga podsieci w dwóch strefach (DB subnet group)
    "private-db-2" = { cidr = "10.0.4.0/24", public = false, az = "eu-north-1b" }
  }
}

variable "db_subnets" {
  description = "Podsieci prywatne bazy danych (DB subnet group)"
  type        = list(string)
  default     = ["private-db", "private-db-2"]
}

variable "db_instance_class" {
  description = "Klasa instancji RDS (Free plan: tylko db.t4g.micro)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "Główna wersja PostgreSQL (minor aktualizuje AWS)"
  type        = string
  default     = "16"
}

variable "db_backup_retention_days" {
  description = "Retencja automatycznych backupów (Free plan AWS dopuszcza maksymalnie 1 dzień)"
  type        = number
  default     = 1
}

variable "app_port" {
  description = "Port backendu FastAPI"
  type        = number
  default     = 8000
}

variable "db_port" {
  description = "Port PostgreSQL"
  type        = number
  default     = 5432
}

variable "github_repository" {
  description = "Repozytorium GitHub (owner/nazwa), któremu rola OIDC pozwala wdrażać"
  type        = string
  default     = "paulatrzcinska/ProjektZespolowy_NAZWA_GRUPY"
}

variable "app_cpu" {
  description = "CPU zadania Fargate backendu (jednostki: 1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "app_memory" {
  description = "Pamięć zadania Fargate backendu w MiB"
  type        = number
  default     = 512
}

variable "app_desired_count" {
  description = "Liczba równolegle działających kontenerów backendu"
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "Retencja logów backendu w CloudWatch (dni)"
  type        = number
  default     = 14
}
