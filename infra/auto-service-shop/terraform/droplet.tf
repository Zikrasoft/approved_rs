resource "digitalocean_ssh_key" "owner" {
  name       = "carlab-shop-owner"
  public_key = file(pathexpand(var.public_key_path))
}

resource "digitalocean_droplet" "shop" {
  name     = "carlab-shop"
  region   = var.do_region
  image    = "ubuntu-24-04-x64"
  size     = "s-2vcpu-4gb"
  ssh_keys = [digitalocean_ssh_key.owner.fingerprint]
}

resource "digitalocean_reserved_ip" "shop" {
  region     = var.do_region
  droplet_id = digitalocean_droplet.shop.id
}

locals {
  public_ports = {
    ssh   = { protocol = "tcp", port = "22" }
    http  = { protocol = "tcp", port = "80" }
    https = { protocol = "tcp", port = "443" }
    http3 = { protocol = "udp", port = "443" }
  }
  anywhere = ["0.0.0.0/0", "::/0"]
}

resource "digitalocean_firewall" "shop" {
  name        = "carlab-shop"
  droplet_ids = [digitalocean_droplet.shop.id]

  dynamic "inbound_rule" {
    for_each = local.public_ports
    content {
      protocol         = inbound_rule.value.protocol
      port_range       = inbound_rule.value.port
      source_addresses = local.anywhere
    }
  }

  dynamic "outbound_rule" {
    for_each = ["tcp", "udp"]
    content {
      protocol              = outbound_rule.value
      port_range            = "1-65535"
      destination_addresses = local.anywhere
    }
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = local.anywhere
  }
}
