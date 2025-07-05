data "aws_route53_zone" "public" {
  count        = local.use_custom_aliases ? 1 : 0
  name         = var.route53_zone_name
  private_zone = false
}

data "aws_acm_certificate" "this" {
  count    = local.use_custom_aliases ? 1 : 0
  provider = aws.us-east-1
  domain   = var.acm_certificate_domain
}
