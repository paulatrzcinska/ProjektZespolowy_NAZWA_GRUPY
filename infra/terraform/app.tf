# Warstwa APP: backend FastAPI jako kontener ECS Fargate w podsieci private-app
# (bez publicznego IP). Ruch wchodzi przez wewnętrzny NLB w podsieci public-web
# (web-sg), do którego łączy się CloudFront (origin VPC). Zachowana kaskada
# grup bezpieczeństwa: CloudFront -> web-sg (NLB) -> app-sg (Fargate) -> db-sg (RDS).

# Rejestr obrazów - workflow CD wypycha obraz oznaczony hashem commita.
resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "IMMUTABLE" # tag = hash commita, raz wypchnięty nie może się zmienić

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-api"
  retention_in_days = var.log_retention_days
}

# Sekrety backendu (DB_PASSWORD, MIGRATION_DB_PASSWORD, JWT_SECRET) jako JSON.
# Terraform tworzy tylko sekret; wartości wpisuje się w konsoli lub AWS CLI,
# żeby nie trafiły do stanu Terraform ani do repozytorium.
resource "aws_secretsmanager_secret" "api" {
  name                    = "${var.project_name}/api"
  description             = "Hasla kont bazy (shop_app, shop_migrator) i JWT_SECRET backendu"
  recovery_window_in_days = 7
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Rola wykonawcza: pobranie obrazu z ECR, logi, odczyt sekretów przy starcie zadania.
resource "aws_iam_role" "task_execution" {
  name               = "${var.project_name}-api-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.api.arn]
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "read-api-secret"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets.json
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

locals {
  api_container_name = "api"

  # Konfiguracja bez sekretów. Wartości tajne wstrzykuje ECS z Secrets Manager.
  api_environment = {
    APP_ENV           = "production"
    API_MODE          = "live"
    APP_VERSION       = "bootstrap" # workflow CD ustawia hash commita
    RUN_MIGRATIONS    = "true"      # alembic upgrade head przed startem API
    DB_HOST           = aws_db_instance.main.address
    DB_PORT           = tostring(var.db_port)
    DB_NAME           = aws_db_instance.main.db_name
    DB_USER           = "shop_app"
    MIGRATION_DB_USER = "shop_migrator"
    DATABASE_SSL_CA   = "/app/certs/global-bundle.pem"
    CORS_ORIGINS      = "https://${aws_cloudfront_distribution.web.domain_name}"
  }

  api_secret_keys = ["DB_PASSWORD", "MIGRATION_DB_PASSWORD", "JWT_SECRET"]
}

# Pierwsza rewizja wskazuje tag zastępczy (obraz jeszcze nie istnieje); kolejne rejestruje
# workflow CD z obrazem oznaczonym hashem commita, dlatego Terraform ignoruje późniejsze zmiany.
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.app_cpu
  memory                   = var.app_memory
  execution_role_arn       = aws_iam_role.task_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = local.api_container_name
    image     = "${aws_ecr_repository.api.repository_url}:bootstrap"
    essential = true

    portMappings = [{
      containerPort = var.app_port
      protocol      = "tcp"
    }]

    environment = [for name, value in local.api_environment : { name = name, value = value }]

    secrets = [for key in local.api_secret_keys : {
      name      = key
      valueFrom = "${aws_secretsmanager_secret.api.arn}:${key}::"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])

  lifecycle {
    ignore_changes = [container_definitions]
  }
}

# Wewnętrzny NLB: punkt wejścia do API dla CloudFront; brak publicznego adresu.
resource "aws_lb" "api" {
  name               = "${var.project_name}-api-nlb"
  internal           = true
  load_balancer_type = "network"
  subnets            = [aws_subnet.this["public-web"].id]
  security_groups    = [aws_security_group.web.id]

  tags = {
    Name = "${var.project_name}-api-nlb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-tg"
  port        = var.app_port
  protocol    = "TCP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  # Ruch do kontenerów wychodzi z adresów NLB (web-sg), więc wystarcza istniejąca
  # reguła app-sg "FastAPI tylko z warstwy web".
  preserve_client_ip   = "false"
  deregistration_delay = 30

  health_check {
    protocol            = "HTTP"
    path                = "/health"
    port                = "traffic-port"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 2
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-api-tg"
  }
}

resource "aws_lb_listener" "api" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.app_desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 90 # czas na migracje i start przed pierwszym health checkiem

  # Nieudane wdrożenie (błąd migracji lub health checku) wraca do poprzedniej rewizji.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = [aws_subnet.this["private-app"].id]
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = local.api_container_name
    container_port   = var.app_port
  }

  depends_on = [aws_lb_listener.api, aws_iam_role_policy_attachment.task_execution]

  lifecycle {
    ignore_changes = [task_definition]
  }
}
