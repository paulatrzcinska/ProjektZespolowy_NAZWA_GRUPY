variable "aws_region" {
  description = "AWS Region allowed by the project account or Learner Lab."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefix and Project tag used by the project's resources."
  type        = string
  default     = "projekt-zespolowy"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,31}$", var.project_name))
    error_message = "Use 3-32 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "environment" {
  description = "Name of the cloud environment. Local Docker is managed separately."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}

variable "vpc_cidr" {
  description = "Dedicated IPv4 /16 network; subnets are derived as /24 blocks."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr)) && can(regex("/16$", var.vpc_cidr))
    error_message = "Provide a valid IPv4 /16 CIDR, for example 10.0.0.0/16."
  }
}

variable "enable_nat_gateway" {
  description = "Create one paid NAT Gateway for App egress. Disabled for the network-only foundation."
  type        = bool
  default     = false
}

variable "api_port" {
  description = "Private FastAPI container port reached only by the Web/ALB security group."
  type        = number
  default     = 8000

  validation {
    condition     = var.api_port >= 1024 && var.api_port <= 65535 && floor(var.api_port) == var.api_port
    error_message = "API port must be an integer between 1024 and 65535."
  }
}
