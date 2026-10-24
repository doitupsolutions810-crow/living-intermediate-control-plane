terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  description = "AWS region for the dedicated That Great Scale runner host."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Dedicated runner VM size; t3.large provides 2 vCPU and 8 GiB RAM."
  type        = string
  default     = "t3.large"
}

variable "runner_host_name" {
  description = "Name tag for the runner host."
  type        = string
  default     = "That-Great-Scale"
}

provider "aws" {
  region = var.aws_region
}

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_iam_role" "runner_host" {
  name = "${var.runner_host_name}-SSM-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })

  tags = { Name = var.runner_host_name }
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.runner_host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "runner_host" {
  name = "${var.runner_host_name}-instance-profile"
  role = aws_iam_role.runner_host.name
}

resource "aws_security_group" "runner_host" {
  name        = "${var.runner_host_name}-egress-only"
  description = "No inbound ports; runner initiates outbound HTTPS connections."
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "Outbound traffic for OS packages, Docker images, GitHub Actions, and SSM."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.runner_host_name}-egress-only" }
}

resource "aws_instance" "runner_host" {
  ami                         = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.runner_host.id]
  iam_instance_profile        = aws_iam_instance_profile.runner_host.name
  associate_public_ip_address = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 30
    tags = {
      Name = "${var.runner_host_name}-root"
    }
  }

  user_data = <<-EOF
    #!/usr/bin/env bash
    set -Eeuo pipefail
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl jq git docker.io
    systemctl enable --now docker
    install -d -m 0750 -o ubuntu -g ubuntu /opt/that-great-scale
    printf '%s\n' 'Host prerequisites installed. Connect with AWS Systems Manager Session Manager, clone the trusted repository branch, and run .github/runner/install-ubuntu.sh as documented.' > /etc/that-great-scale-bootstrap.txt
  EOF


  tags = {
    Name      = var.runner_host_name
    Purpose   = "ephemeral-github-actions-runner-host"
    ManagedBy = "Terraform"
  }

  depends_on = [aws_iam_role_policy_attachment.ssm_core]
}

output "runner_instance_id" {
  description = "Use this instance ID to connect through AWS Systems Manager Session Manager."
  value       = aws_instance.runner_host.id
}

output "runner_public_ip" {
  description = "Public IP for outbound connectivity; no inbound security-group rules are configured."
  value       = aws_instance.runner_host.public_ip
}
