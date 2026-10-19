resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_default_security_group" "closed" {
  vpc_id  = aws_vpc.main.id
  ingress = []
  egress  = []

  tags = { Name = "${local.name}-default-closed" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  for_each = local.zones

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value
  cidr_block              = local.public_cidrs[each.key]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name}-public-web-${each.key}"
    Tier = "web"
  }
}

resource "aws_subnet" "app" {
  for_each = local.zones

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value
  cidr_block              = local.app_cidrs[each.key]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name}-private-app-${each.key}"
    Tier = "app"
  }
}

resource "aws_subnet" "database" {
  for_each = local.zones

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value
  cidr_block              = local.database_cidrs[each.key]
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name}-private-database-${each.key}"
    Tier = "database"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-public-web" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "app" {
  for_each = local.zones

  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-private-app-${each.key}" }
}

resource "aws_route_table_association" "app" {
  for_each = aws_subnet.app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.app[each.key].id
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-private-database-isolated" }
}

resource "aws_route_table_association" "database" {
  for_each = aws_subnet.database

  subnet_id      = each.value.id
  route_table_id = aws_route_table.database.id
}

resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? 1 : 0

  domain = "vpc"
  tags   = { Name = "${local.name}-nat" }
}

resource "aws_nat_gateway" "app" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public["a"].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "${local.name}-nat" }
}

resource "aws_route" "app_egress" {
  for_each = var.enable_nat_gateway ? local.zones : {}

  route_table_id         = aws_route_table.app[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.app[0].id
}

# S3 Gateway endpoints have no hourly endpoint fee. DB routes remain isolated.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [for table in aws_route_table.app : table.id]

  tags = { Name = "${local.name}-s3" }
}
