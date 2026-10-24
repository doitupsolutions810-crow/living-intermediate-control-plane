# AWS host for That Great Scale

This Terraform configuration provisions a dedicated Ubuntu 24.04 EC2 host for the ephemeral GitHub Actions runner in `.github/runner/`.

## Security and cost boundaries

- **This is infrastructure code, not a provisioned host.** Applying it creates billable AWS resources.
- Default is `us-east-1`, `t3.large` (2 vCPU, 8 GiB RAM), and a 30 GiB encrypted gp3 root volume. Change `aws_region` or `instance_type` as appropriate.
- It creates no inbound security-group rules and no SSH key. Use AWS Systems Manager Session Manager for administration.
- The instance profile grants the AWS-managed `AmazonSSMManagedInstanceCore` policy. It does not grant broad access to AWS resources.
- The default VPC must have a usable subnet and outbound connectivity. For a production account, prefer a dedicated VPC/subnet and controlled egress.
- Terraform state and AWS account permissions remain under the operator's control.

## Provision

Install Terraform and AWS CLI, authenticate using an AWS profile or short-lived role credentials, then from this directory:

```sh
terraform init
terraform fmt -check
terraform validate
terraform plan -out=tfplan
# Review the plan and estimated charges before approving creation:
terraform apply tfplan
```

After creation, open **EC2 → Instances → Connect → Session Manager** (or use `aws ssm start-session --target <instance-id> --region <region>`). In the session, clone the trusted control-plane repository branch `research/great-scale-api-contract`, enter the repository root, and run:

```sh
sudo bash .github/runner/install-ubuntu.sh
```

The installer prompts for a fine-grained GitHub PAT scoped to `doitupsolutions810-crow/living-intermediate-control-plane` with **Administration: write** permission. Enter it only in the interactive prompt; never put it in Terraform variables, user-data, shell history, commits, or logs. The PAT is written to a root-only host file by the existing installer.

Verify the service and registration:

```sh
sudo systemctl status great-scale-runner.service
sudo journalctl -u great-scale-runner.service -n 100 --no-pager
```

Then check **Repository Settings → Actions → Runners** for an online runner with labels `self-hosted`, `linux`, `x64`, `great-scale`. Only then can the trusted-branch workflow jobs leave the queued state. Pull-request jobs remain on GitHub-hosted runners.

## Cleanup

After confirming no job is running, destroy the resources through the same Terraform state:

```sh
terraform destroy
```

The default VPC is shared infrastructure and is not destroyed by this configuration.
