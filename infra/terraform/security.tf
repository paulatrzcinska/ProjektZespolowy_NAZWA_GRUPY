# Standalone rule resources own rules; AWS's default allow-all egress is removed
# when these aws_security_group resources are created by Terraform.
resource "aws_security_group" "web" {
  name_prefix = "${local.name}-web-"
  description = "Public HTTPS entry point; attach only to the application load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-web" }
}

resource "aws_security_group" "app" {
  name_prefix = "${local.name}-app-"
  description = "Private FastAPI tasks; inbound traffic only from the load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-app" }
}

resource "aws_security_group" "database" {
  name_prefix = "${local.name}-database-"
  description = "Private PostgreSQL; inbound traffic only from FastAPI"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-database" }
}

resource "aws_vpc_security_group_ingress_rule" "web_https" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS to the public ALB"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "web_to_app" {
  security_group_id            = aws_security_group.web.id
  referenced_security_group_id = aws_security_group.app.id
  description                  = "ALB requests and health checks to FastAPI"
  from_port                    = var.api_port
  to_port                      = var.api_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "app_from_web" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.web.id
  description                  = "FastAPI accepts requests only from the ALB"
  from_port                    = var.api_port
  to_port                      = var.api_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_to_database" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.database.id
  description                  = "PostgreSQL connections from FastAPI"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "database_from_app" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.app.id
  description                  = "PostgreSQL accepts connections only from FastAPI"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# This permits outbound HTTPS, not inbound Internet access. With NAT disabled
# only destinations reachable by a specific route (currently S3) are available.
resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS for AWS services and the selected payment provider"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}
