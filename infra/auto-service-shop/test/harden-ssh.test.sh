#!/bin/sh
set -eu

here="$(cd "$(dirname -- "$0")/.." && pwd)"

docker run --rm -i --cap-add NET_ADMIN -v "$here/harden-ssh.sh:/harden-ssh.sh:ro" ubuntu:24.04 sh -s <<'TEST'
set -u
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq openssh-server netcat-openbsd iproute2 >/dev/null 2>&1 || exit 1
printf '#!/bin/sh\n' >/usr/local/bin/systemctl
chmod +x /usr/local/bin/systemctl
mkdir -p /run/sshd
ssh-keygen -A >/dev/null

useradd --create-home --shell /bin/sh deploy
passwd --lock deploy >/dev/null
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
ssh-keygen -q -t ed25519 -N '' -f /tmp/deploy
ssh-keygen -q -t ed25519 -N '' -f /tmp/crawler
install -m 0600 -o deploy -g deploy /tmp/deploy.pub /home/deploy/.ssh/authorized_keys
printf 'not a key\n' >/tmp/bad.pub

failures=0
expect() {
  name=$1
  shift
  if out=$("$@" 2>&1); then echo "ok - $name"; else
    echo "not ok - $name"
    printf '%s\n' "$out" | sed 's/^/# /'
    failures=$((failures + 1))
  fi
}
refuse() {
  name=$1
  shift
  if "$@" >/dev/null 2>&1; then echo "not ok - $name"; failures=$((failures + 1)); else echo "ok - $name"; fi
}
refused() {
  timeout 5 "$@"
  [ $? = 255 ]
}
reports() {
  sshd -T -C "user=$1,host=localhost,addr=203.0.113.1" | grep -qix "$2"
}

refuse 'a file that is not a public key is refused' env SUDO_USER=deploy sh /harden-ssh.sh /tmp/bad.pub
refuse 'a refused key creates no crawler user' id crawler
expect 'hardening without a crawler key succeeds' env SUDO_USER=deploy sh /harden-ssh.sh
expect 'hardening with the crawler key succeeds' env SUDO_USER=deploy sh /harden-ssh.sh /tmp/crawler.pub
cp /etc/ssh/sshd_config.d/00-carlab.conf /tmp/first.conf
expect 'a rerun succeeds' env SUDO_USER=deploy sh /harden-ssh.sh /tmp/crawler.pub
expect 'a rerun writes the same config' cmp /tmp/first.conf /etc/ssh/sshd_config.d/00-carlab.conf
expect 'a rerun keeps one crawler key' test "$(wc -l </home/crawler/.ssh/authorized_keys)" = 1
expect 'a rerun without a key keeps the crawler key' env SUDO_USER=deploy sh /harden-ssh.sh
expect 'the crawler key survives' test -s /home/crawler/.ssh/authorized_keys
expect 'crawler has no login shell' test "$(getent passwd crawler | cut -d: -f7)" = /usr/sbin/nologin
expect 'the crawler cannot edit its own keys' test "$(stat -c %U /home/crawler/.ssh/authorized_keys)" = root
expect 'the crawler key is limited to the postgres address' grep -q '^restrict,port-forwarding,permitopen="10.200.0.10:5432" ssh-ed25519 ' /home/crawler/.ssh/authorized_keys

expect 'deploy keeps forwarding off' reports deploy 'allowtcpforwarding no'
expect 'root keeps forwarding off' reports root 'allowtcpforwarding no'
expect 'crawler forwards local only' reports crawler 'allowtcpforwarding local'
expect 'crawler may open postgres only' reports crawler 'permitopen 10.200.0.10:5432'
expect 'crawler may not listen' reports crawler 'permitlisten none'
expect 'crawler gets no tty' reports crawler 'permittty no'
expect 'crawler gets no agent' reports crawler 'allowagentforwarding no'
expect 'crawler gets no X11' reports crawler 'x11forwarding no'
expect 'crawler runs no command' reports crawler 'forcecommand /bin/false'
refuse 'deploy has no forced command' reports deploy 'forcecommand /bin/false'

ip addr add 10.200.0.10/32 dev lo
ip addr add 10.200.0.11/32 dev lo
(while :; do echo postgres | nc -N -l 10.200.0.10 5432; done) >/dev/null 2>&1 &
(while :; do echo other | nc -N -l 10.200.0.11 5432; done) >/dev/null 2>&1 &
/usr/sbin/sshd
sleep 1
opts='-o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ExitOnForwardFailure=yes -o LogLevel=ERROR'
through() {
  key=$1 user=$2 target=$3
  ssh $opts -i "$key" -N -L "15432:$target" "$user@127.0.0.1" &
  pid=$!
  sleep 1
  got=$(nc -w 2 127.0.0.1 15432 </dev/null)
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  [ "$got" = postgres ]
}
expect 'the crawler tunnel reaches postgres' through /tmp/crawler crawler 10.200.0.10:5432
refuse 'the crawler tunnel reaches nothing else' through /tmp/crawler crawler 10.200.0.11:5432
refuse 'deploy cannot tunnel' through /tmp/deploy deploy 10.200.0.10:5432
refuse 'the crawler runs no command' ssh $opts -i /tmp/crawler crawler@127.0.0.1 true
expect 'the crawler cannot forward remote ports' refused ssh $opts -i /tmp/crawler -N -R 2222:127.0.0.1:22 crawler@127.0.0.1
expect 'deploy still logs in' ssh $opts -i /tmp/deploy deploy@127.0.0.1 true

[ "$failures" -eq 0 ]
TEST
