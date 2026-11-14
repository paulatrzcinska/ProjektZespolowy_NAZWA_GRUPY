# Podsieć private-app nie ma trasy do Internetu (brak NAT), a Fargate musi pobrać
# obraz z ECR, wysłać logi do CloudWatch i odczytać sekrety. Zapewniają to prywatne
# punkty końcowe VPC - ruch do usług AWS nie opuszcza sieci AWS.

resource "aws_security_group" "vpc_endpoints" {
  name        = "vpce-sg"
  description = "Punkty koncowe VPC - HTTPS tylko z warstwy app"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "vpce-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpce_from_app" {
  security_group_id            = aws_security_group.vpc_endpoints.id
  description                  = "HTTPS z warstwy app"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

# Warstwy obrazów ECR leżą w S3 - bezpłatny punkt końcowy typu Gateway.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "vpce-s3"
  }
}

resource "aws_vpc_endpoint" "interface" {
  for_each = toset(["ecr.api", "ecr.dkr", "logs", "secretsmanager"])

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.this["private-app"].id]
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "vpce-${each.key}"
  }
}
