variable "aws_region" {
  description = "The AWS region where resources will be deployed."
  default     = "ap-southeast-1"
}

variable "project_code" {
  description = "The code name of the project used for naming convention."
}

variable "env" {
  description = "The target environment to which the resources will be deployed."
}

variable "custom_aliases" {
  description = "The custom aliases for the cloudfront distribution. Specify this variable to use a custom domain with the cloudfront distribution."
  default     = null
}

variable "acm_certificate_domain" {
  description = "The domain name associated with the acm certificate. Specify this only if `custom_aliases` is specified."
  default     = null
}

variable "route53_zone_name" {
  description = "The name of the Route 53 hosted zone to create DNS record for custom domain name(s). Specify this only if `custom_aliases` is specified."
  default     = null
}
