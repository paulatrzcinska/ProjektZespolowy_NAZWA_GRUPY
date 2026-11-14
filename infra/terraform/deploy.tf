# Dostęp GitHub Actions do konta AWS: techniczny użytkownik IAM bez dostępu do konsoli.
#
# OIDC (federacja tożsamości) jest na tym koncie niedostępne: polityka SCP planu
# Free blokuje iam:CreateOpenIDConnectProvider. Dlatego workflow używa kluczy
# dostępowych tego użytkownika, przechowywanych jako sekrety środowiska GitHub
# "production" (dostępne tylko dla jobów wdrożeniowych z gałęzi main).
#
# Klucza nie tworzy Terraform (trafiłby jawnie do pliku stanu) - generuje się go
# ręcznie: aws iam create-access-key --user-name pz-github-deploy

data "aws_caller_identity" "current" {}

resource "aws_iam_user" "github_deploy" {
  name = "${var.project_name}-github-deploy"

  tags = {
    Purpose = "Wdrozenie z GitHub Actions: S3/CloudFront dla web, ECR/ECS dla API"
  }
}

# Minimalne uprawnienia: tylko zapis do hostingu web i aktualizacja usługi API.
data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "WebBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.web.arn]
  }

  statement {
    sid       = "WebBucketObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]
  }

  statement {
    sid       = "WebCacheInvalidation"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.web.arn]
  }

  statement {
    sid       = "EcrLogin"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.api.arn]
  }

  # Te akcje ECS nie wspierają ograniczenia do konkretnego zasobu.
  statement {
    sid       = "EcsTaskDefinitions"
    effect    = "Allow"
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }

  statement {
    sid       = "EcsService"
    effect    = "Allow"
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = [aws_ecs_service.api.id]
  }

  statement {
    sid       = "PassTaskExecutionRole"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.task_execution.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_user_policy" "github_deploy" {
  name   = "deploy"
  user   = aws_iam_user.github_deploy.name
  policy = data.aws_iam_policy_document.github_deploy.json
}
