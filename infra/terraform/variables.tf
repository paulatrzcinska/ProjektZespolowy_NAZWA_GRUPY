variable "aws_region" {
  description = "Region AWS projektu (w nowym trybie AWS przypisany automatycznie)"
  type        = string
  default     = "eu-north-1"
}

variable "availability_zone" {
  description = "Strefa dostępności dla podsieci"
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
  }))
  default = {
    "public-web"  = { cidr = "10.0.1.0/24", public = true }
    "private-app" = { cidr = "10.0.2.0/24", public = false }
    "private-db"  = { cidr = "10.0.3.0/24", public = false }
  }
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
