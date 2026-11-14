# Warstwa WEB: statyczny build React w prywatnym buckecie S3, publikowany przez
# CloudFront. Ta sama dystrybucja kieruje ścieżki API do backendu w VPC, dzięki
# czemu frontend i API mają wspólny publiczny adres (brak CORS, jedno TLS).

resource "aws_s3_bucket" "web" {
  bucket = "${var.project_name}-web-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-web"
  }
}

# Bucket nie jest publiczny - pliki czyta wyłącznie CloudFront (OAC).
resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Poprzednie wersje plików zostają w buckecie - szybki powrót do wcześniejszego buildu.
resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    sid       = "AllowCloudFrontRead"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.web]
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project_name}-web-oac"
  description                       = "Podpisany dostep CloudFront do bucketu web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Trasy aplikacji React (np. /products/3) nie istnieją jako pliki w S3 -
# funkcja przepisuje je na index.html; żądania plików (z rozszerzeniem) przechodzą bez zmian.
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${var.project_name}-web-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Trasy SPA -> index.html"
  publish = true
  code    = file("${path.module}/functions/spa-rewrite.js")
}

# Origin VPC: CloudFront łączy się z wewnętrznym NLB bez wystawiania go do Internetu.
resource "aws_cloudfront_vpc_origin" "api" {
  vpc_origin_endpoint_config {
    name                   = "${var.project_name}-api-nlb"
    arn                    = aws_lb.api.arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }
}

locals {
  web_origin_id = "web-s3"
  api_origin_id = "api-nlb"

  # Ścieżki obsługiwane przez backend; wszystko inne to pliki frontendu.
  api_path_patterns = ["/api/*", "/health", "/docs", "/openapi.json"]

  # Zarządzane polityki CloudFront (identyfikatory stałe dla wszystkich kont).
  cache_policy_caching_optimized           = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  cache_policy_caching_disabled            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  origin_request_policy_all_viewer_no_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}: aplikacja web + API"
  default_root_object = "index.html"
  http_version        = "http2and3"
  price_class         = "PriceClass_100" # Europa i Ameryka Płn. - najtańsza klasa

  origin {
    origin_id                = local.web_origin_id
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = aws_lb.api.dns_name

    vpc_origin_config {
      vpc_origin_id            = aws_cloudfront_vpc_origin.api.id
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id       = local.web_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.cache_policy_caching_optimized

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.api_path_patterns

    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = local.api_origin_id
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.cache_policy_caching_disabled
      origin_request_policy_id = local.origin_request_policy_all_viewer_no_host
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Domena *.cloudfront.net z certyfikatem AWS; własna domena wymagałaby ACM w us-east-1.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.project_name}-web"
  }
}
