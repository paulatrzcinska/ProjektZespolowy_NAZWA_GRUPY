# Mocked plan tests never contact AWS or create billable resources.
mock_provider "aws" {
  override_during = plan

  mock_data "aws_availability_zones" {
    defaults = {
      names = ["eu-central-1a", "eu-central-1b"]
    }
  }
}

# Explicit plan-time IDs make cross-resource reference assertions deterministic.
override_resource {
  target          = aws_security_group.web
  override_during = plan
  values          = { id = "sg-00000000000000001" }
}

override_resource {
  target          = aws_security_group.app
  override_during = plan
  values          = { id = "sg-00000000000000002" }
}

override_resource {
  target          = aws_security_group.database
  override_during = plan
  values          = { id = "sg-00000000000000003" }
}

override_resource {
  target          = aws_route_table.public
  override_during = plan
  values          = { id = "rtb-00000000000000001" }
}

override_resource {
  target          = aws_route_table.app["a"]
  override_during = plan
  values          = { id = "rtb-00000000000000002" }
}

override_resource {
  target          = aws_route_table.app["b"]
  override_during = plan
  values          = { id = "rtb-00000000000000003" }
}

override_resource {
  target          = aws_route_table.database
  override_during = plan
  values = {
    id    = "rtb-00000000000000004"
    route = []
  }
}

run "isolated_network_by_default" {
  command = plan

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16" && aws_vpc.main.enable_dns_support && aws_vpc.main.enable_dns_hostnames
    error_message = "The project needs its own /16 VPC with DNS enabled."
  }

  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.app) == 2 && length(aws_subnet.database) == 2
    error_message = "Every tier must have one subnet in each of two Availability Zones."
  }

  assert {
    condition = length(distinct(concat(
      [for subnet in aws_subnet.public : subnet.cidr_block],
      [for subnet in aws_subnet.app : subnet.cidr_block],
      [for subnet in aws_subnet.database : subnet.cidr_block]
    ))) == 6
    error_message = "The six /24 subnets must use separate CIDR blocks."
  }

  assert {
    condition = alltrue(concat(
      [for subnet in aws_subnet.public : !subnet.map_public_ip_on_launch],
      [for subnet in aws_subnet.app : !subnet.map_public_ip_on_launch],
      [for subnet in aws_subnet.database : !subnet.map_public_ip_on_launch]
    ))
    error_message = "Subnets must not automatically assign public IPv4 addresses."
  }

  assert {
    condition     = length(aws_nat_gateway.app) == 0 && length(aws_eip.nat) == 0 && length(aws_route.app_egress) == 0
    error_message = "The default foundation must not create paid NAT or EIP resources."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.web_https.cidr_ipv4 == "0.0.0.0/0" && aws_vpc_security_group_ingress_rule.web_https.from_port == 443 && aws_vpc_security_group_ingress_rule.web_https.to_port == 443
    error_message = "Only the Web/ALB tier should expose HTTPS to the Internet."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.app_from_web.cidr_ipv4 == null && aws_vpc_security_group_ingress_rule.app_from_web.from_port == 8000 && aws_vpc_security_group_ingress_rule.database_from_app.cidr_ipv4 == null && aws_vpc_security_group_ingress_rule.database_from_app.from_port == 5432
    error_message = "App and DB ingress must use security group references, never public CIDRs."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.app_from_web.referenced_security_group_id == aws_security_group.web.id && aws_vpc_security_group_ingress_rule.database_from_app.referenced_security_group_id == aws_security_group.app.id
    error_message = "The only inbound path must be Web to App to Database."
  }

  assert {
    condition     = aws_route.public_internet.route_table_id == aws_route_table.public.id && alltrue([for association in aws_route_table_association.database : association.route_table_id == aws_route_table.database.id]) && length(aws_route_table.database.route) == 0
    error_message = "Internet routing must belong to Web; Database must keep its own isolated route table."
  }

  assert {
    condition     = aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway" && length(aws_vpc_endpoint.s3.route_table_ids) == 2
    error_message = "Only private App route tables should receive an S3 Gateway endpoint."
  }
}

run "optional_nat_for_private_runtime" {
  command = plan

  variables {
    enable_nat_gateway = true
  }

  assert {
    condition     = length(aws_nat_gateway.app) == 1 && length(aws_eip.nat) == 1 && length(aws_route.app_egress) == 2
    error_message = "Enabling NAT must add one shared gateway and egress routes for both App subnets."
  }
}

run "reject_non_ipv4_or_non_16_cidr" {
  command = plan

  variables {
    vpc_cidr = "10.0.0.0/24"
  }

  expect_failures = [var.vpc_cidr]
}
