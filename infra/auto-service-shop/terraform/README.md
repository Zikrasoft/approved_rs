# The shop's AWS infrastructure

One `terraform apply` creates what
[deploy.md § The first ship: a checklist](../../../docs/guides/deploy.md#the-first-ship-a-checklist)
steps 1, 5 and 6 describe, exactly as [Files on S3](../../../docs/guides/deploy.md#files-on-s3)
and [Backup and restore](../../../docs/guides/deploy.md#backup-and-restore) specify:

| What                      | Where        | Details                                                                                                                                                |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lightsail instance        | `eu-north-1` | `carlab-shop`, Ubuntu 24.04 LTS, the $24 bundle (4 GB, 2 vCPU, 80 GB), IPv4 only, your own ssh key, no automatic snapshots                             |
| Static IP                 | `eu-north-1` | attached to the instance                                                                                                                               |
| Firewall                  | `eu-north-1` | 22/tcp, 80/tcp, 443/tcp, 443/udp, IPv4                                                                                                                 |
| Public bucket             | `eu-north-1` | ACLs off, `s3:GetObject` for everyone, versioned, noncurrent versions expire after 30 days                                                             |
| Private bucket            | `eu-north-1` | ACLs off, all public access blocked, not versioned                                                                                                     |
| IAM user `carlab-shop`    | global       | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on the two shop buckets; its key goes to `/srv/carlab/.env`                         |
| IAM user `carlab-crawler` | global       | `s3:PutObject`, `s3:GetObject` on `crawl/*` of the private bucket, `s3:ListBucket` under that prefix; its key goes only to the Mac's `.env.crawler`    |
| Backup bucket             | `eu-north-1` | ACLs off, all public access blocked; `backup.sh` deletes copies older than 30 days itself                                                              |
| IAM user `carlab-backup`  | global       | `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, `s3:ListBucket` on the backup bucket only; its key goes to `.env.backup` |

## State holds the keys

The state is local, in this directory (`terraform.tfstate`), and gitignored,
because it holds the three IAM secret access keys in plain text. Keep it: losing
it means Terraform no longer knows what it created. Back it up somewhere private
(a password manager attachment, an encrypted disk), never into the repository.

## Prerequisites

1. Terraform 1.16.6 exactly, the version `versions.tf` pins (from
   `releases.hashicorp.com/terraform/1.16.6/`; a newer one means bumping the pin
   in its own commit), and the AWS CLI (`brew install awscli`).
2. An IAM user with administrator rights for Terraform itself. In the AWS
   console: IAM → Users → Create user, name `carlab-terraform`, no console
   access, Attach policies directly → `AdministratorAccess`. Open the user →
   Security credentials → Create access key → "Command Line Interface (CLI)".
3. Store the key under the `carlab` profile; the CLI prompts for the values, so
   they stay out of the shell history:

   ```bash
   aws configure --profile carlab
   # Default region name: eu-north-1, output format: json
   aws sts get-caller-identity --profile carlab
   ```

4. An ssh key on this Mac. The default is `~/.ssh/id_rsa.pub`; another one is
   `-var public_key_path=...`.

## Create it

Bucket names are global across all of AWS, so pick your own and put them in
`terraform.tfvars` here (it holds no secret):

```hcl
public_bucket  = "carlab-shop-public-<something unique>"
private_bucket = "carlab-shop-private-<something unique>"
backup_bucket  = "carlab-shop-backup-<something unique>"
```

```bash
cd infra/auto-service-shop/terraform
terraform init
terraform plan
terraform apply
terraform output
```

`terraform output` prints the static IPv4, the ssh commands, the bucket
names, the regions and the endpoints; the keys show as `<sensitive>`. To write
them into env files without printing them:

```bash
./render-env.sh            # or ./render-env.sh <directory>
```

It writes, each with mode 600, into `rendered/` (gitignored) and prints only the
file paths and variable names:

- `shop.env`: `FILE_URL` and the `S3_*` lines for `/srv/carlab/.env`
  (`S3_ENDPOINT` stays empty for AWS)
- `crawler.env`: the `S3_*` lines for the Mac's `.env.crawler`, with the
  crawler's own key
- `backup.env`: the whole of `/srv/carlab/.env.backup`

Copy each into place without printing it, for example
`scp rendered/backup.env deploy@<IPv4>:/srv/carlab/.env.backup`, then
`ssh deploy@<IPv4> 'chmod 600 /srv/carlab/.env.backup'`. Delete `rendered/` once
the values are on the server and the Mac.

## What stays manual

Follow [deploy.md § The first ship: a checklist](../../../docs/guides/deploy.md#the-first-ship-a-checklist)
from step 2:

- **Bootstrap** (step 2): `bootstrap-host.sh` as `ubuntu`, then `harden-ssh.sh`
  through `sudo` from a kept-open `deploy` session.
- **DNS** (step 3): at the .rs registrar, A records for `api.carlab.rs` and
  `admin.carlab.rs` at `terraform output ipv4`.
- **`.env`** (steps 4, 5 and 6): every other value of `/srv/carlab/.env`, plus
  the lines from `render-env.sh`; `.env.backup` from `backup.env`.
- **CI secrets** (step 7), then the first deploy and everything after it.
