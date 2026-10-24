#!/bin/sh
set -eu

DEPLOY_USER=${DEPLOY_USER:-deploy}

[ "$(id -u)" = 0 ] || {
  echo "Run as root." >&2
  exit 1
}

[ "${SUDO_USER:-}" = "$DEPLOY_USER" ] || {
  echo "Run via sudo from a $DEPLOY_USER ssh session." >&2
  exit 1
}

[ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ] || {
  echo "/home/$DEPLOY_USER/.ssh/authorized_keys is empty. Locking root out now would leave nobody able to log in." >&2
  exit 1
}

conf=/etc/ssh/sshd_config.d/00-carlab.conf
cat >"$conf" <<CONF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
AuthenticationMethods publickey
MaxAuthTries 6
LoginGraceTime 20
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
AllowUsers $DEPLOY_USER
CONF

sshd -t || {
  rm -f "$conf"
  exit 1
}

for want in "permitrootlogin no" "passwordauthentication no" \
  "kbdinteractiveauthentication no" "permitemptypasswords no" \
  "authenticationmethods publickey" "allowusers $DEPLOY_USER"; do
  sshd -T -C "user=$DEPLOY_USER,host=localhost,addr=203.0.113.1" | grep -qix "$want" || {
    echo "sshd reports something other than '$want': another drop-in in /etc/ssh/sshd_config.d/ sorts before 00-carlab.conf, or /etc/ssh/sshd_config sets it above its Include line." >&2
    rm -f "$conf"
    exit 1
  }
done

systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "Root login and passwords are off. Only $DEPLOY_USER, by key."
