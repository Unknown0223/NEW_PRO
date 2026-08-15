variable "environment" {
  description = "deployment environment: staging | production"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Railway project name"
  type        = string
  default     = "salec"
}
