# One SNS topic that every CloudWatch alarm in this stack notifies.
# SES / SMTP: OutSystems sends email through an SMTP server configured in
# Service Center (Scheduler role). Amazon SES SMTP (email-smtp.<region>.amazonaws.com:587)
# is the intended relay; the verified domain identity and SMTP credentials are
# created outside this stack (see README).

resource "aws_sns_topic" "alarms" {
  name              = "${local.name_prefix}-alarms"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}
