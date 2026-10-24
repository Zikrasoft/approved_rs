#!/bin/sh
set -eu

DEPLOY_USER=${DEPLOY_USER:-deploy}
DEPLOY_DIR=/srv/carlab
BACKUP_DIR=/var/backups/carlab

[ "$(id -u)" = 0 ] || {
  echo "Run as root." >&2
  exit 1
}

export DEBIAN_FRONTEND=noninteractive

echo "==> Packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban unattended-upgrades sudo

echo "==> Swap"
if [ -z "$(swapon --show)" ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

echo "==> Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "$(sed -n 's/^VERSION_CODENAME=//p' /etc/os-release)" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true,
  "no-new-privileges": true,
  "userland-proxy": false
}
JSON
systemctl enable --now docker
systemctl restart docker

echo "==> User $DEPLOY_USER"
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
passwd --lock "$DEPLOY_USER" >/dev/null
usermod --append --groups docker "$DEPLOY_USER"

install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
keys="/home/$DEPLOY_USER/.ssh/authorized_keys"
if [ -s /root/.ssh/authorized_keys ]; then
  touch "$keys"
  cat /root/.ssh/authorized_keys "$keys" | awk 'NF && !seen[$0]++' >"$keys.next"
  install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$keys.next" "$keys"
  rm -f "$keys.next"
fi

sudoers=$(mktemp)
printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$DEPLOY_USER" >"$sudoers"
visudo -cf "$sudoers" >/dev/null
install -m 0440 -o root -g root "$sudoers" "/etc/sudoers.d/90-$DEPLOY_USER"
rm -f "$sudoers"

echo "==> Directories"
install -d -m 0750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_DIR"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BACKUP_DIR"
[ -e /var/log/carlab-backup.log ] || install -m 0640 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null /var/log/carlab-backup.log

echo "==> Nightly backup"
printf '30 3 * * * %s %s/backup.sh >>/var/log/carlab-backup.log 2>&1\n' "$DEPLOY_USER" "$DEPLOY_DIR" \
  >/etc/cron.d/carlab-backup
chmod 0644 /etc/cron.d/carlab-backup

echo "==> Firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw limit 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

echo "==> fail2ban"
cat >/etc/fail2ban/jail.d/sshd.local <<'JAIL'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Unattended security upgrades"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
systemctl enable --now unattended-upgrades

echo "==> Kernel"
cat >/etc/sysctl.d/99-carlab.conf <<'SYSCTL'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_source_route = 0
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
vm.swappiness = 10
SYSCTL
sysctl --system >/dev/null

echo "==> Done. Log in as $DEPLOY_USER with your key, then run harden-ssh.sh."
