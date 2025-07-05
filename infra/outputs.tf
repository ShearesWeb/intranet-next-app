output "origin_bucket_name" {
  value = module.cloudfront_s3_origin.new_bucket.bucket
}
