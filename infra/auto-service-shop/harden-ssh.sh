#!/bin/sh
set -eu

DEPLOY_USER=${DEPLOY_USER:-deploy}
CRAWLER_USER=crawler
POSTGRES_ADDRESS=10.200.0.10:5432
crawler_key=${1:-}

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

[ -z "$crawler_key" ] || ssh-keygen -l -f "$crawler_key" >/dev/null || {
  echo "$crawler_key is not a public key." >&2
  exit 1
}

id "$CRAWLER_USER" >/dev/null 2>&1 ||
  useradd --system --create-home --shell /usr/sbin/nologin "$CRAWLER_USER"
usermod --shell /usr/sbin/nologin "$CRAWLER_USER" 2>/dev/null
passwd --lock "$CRAWLER_USER" >/dev/null
install -d -m 0755 -o root -g root "/home/$CRAWLER_USER/.ssh"
crawler_keys="/home/$CRAWLER_USER/.ssh/authorized_keys"
if [ -n "$crawler_key" ]; then
  awk -v open="$POSTGRES_ADDRESS" 'NF { print "restrict,port-forwarding,permitopen=\"" open "\" " $0 }' "$crawler_key" >"$crawler_keys.next"
  install -m 0644 -o root -g root "$crawler_keys.next" "$crawler_keys"
  rm -f "$crawler_keys.next"
fi

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
AllowUsers $DEPLOY_USER $CRAWLER_USER

Match User $CRAWLER_USER
  AllowTcpForwarding local
  PermitOpen $POSTGRES_ADDRESS
  PermitListen none
  AllowStreamLocalForwarding no
  PermitTunnel no
  PermitTTY no
  X11Forwarding no
  AllowAgentForwarding no
  ForceCommand /bin/false
CONF

sshd -t || {
  rm -f "$conf"
  exit 1
}

reports() {
  user=$1
  shift
  for want in "$@"; do
    sshd -T -C "user=$user,host=localhost,addr=203.0.113.1" | grep -qix "$want" || {
      echo "sshd reports something other than '$want' for $user: another drop-in in /etc/ssh/sshd_config.d/ sorts before 00-carlab.conf, or /etc/ssh/sshd_config sets it above its Include line." >&2
      rm -f "$conf"
      exit 1
    }
  done
}

reports "$DEPLOY_USER" "permitrootlogin no" "passwordauthentication no" \
  "kbdinteractiveauthentication no" "permitemptypasswords no" \
  "authenticationmethods publickey" "allowusers $DEPLOY_USER" "allowusers $CRAWLER_USER" \
  "allowtcpforwarding no"
reports "$CRAWLER_USER" "allowtcpforwarding local" "permitopen $POSTGRES_ADDRESS" \
  "permitlisten none" "permittty no" "forcecommand /bin/false"

systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "Root login and passwords are off. Only $DEPLOY_USER by key, and $CRAWLER_USER for the Postgres tunnel."
[ -s "$crawler_keys" ] || echo "$CRAWLER_USER has no key yet: rerun with the owner's public key file as the argument." >&2
