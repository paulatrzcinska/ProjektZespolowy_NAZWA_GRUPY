locals {
  name = "${var.project_name}-${var.environment}"

  zones = {
    a = data.aws_availability_zones.available.names[0]
    b = data.aws_availability_zones.available.names[1]
  }

  public_cidrs = {
    a = cidrsubnet(var.vpc_cidr, 8, 0)
    b = cidrsubnet(var.vpc_cidr, 8, 1)
  }

  app_cidrs = {
    a = cidrsubnet(var.vpc_cidr, 8, 10)
    b = cidrsubnet(var.vpc_cidr, 8, 11)
  }

  database_cidrs = {
    a = cidrsubnet(var.vpc_cidr, 8, 20)
    b = cidrsubnet(var.vpc_cidr, 8, 21)
  }
}
