resource "aws_lightsail_key_pair" "owner" {
  name       = "carlab-shop-owner"
  public_key = file(pathexpand(var.public_key_path))
}

resource "aws_lightsail_instance" "shop" {
  name              = "carlab-shop"
  availability_zone = "${var.region}a"
  blueprint_id      = "ubuntu_24_04"
  bundle_id         = "medium_3_0"
  ip_address_type   = "ipv4"
  key_pair_name     = aws_lightsail_key_pair.owner.name
}

resource "aws_lightsail_static_ip" "shop" {
  name = "carlab-shop"
}

resource "aws_lightsail_static_ip_attachment" "shop" {
  static_ip_name = aws_lightsail_static_ip.shop.name
  instance_name  = aws_lightsail_instance.shop.name
}

locals {
  public_ports = {
    ssh   = { protocol = "tcp", port = 22 }
    http  = { protocol = "tcp", port = 80 }
    https = { protocol = "tcp", port = 443 }
    http3 = { protocol = "udp", port = 443 }
  }
}

resource "aws_lightsail_instance_public_ports" "shop" {
  instance_name = aws_lightsail_instance.shop.name

  dynamic "port_info" {
    for_each = local.public_ports
    content {
      protocol  = port_info.value.protocol
      from_port = port_info.value.port
      to_port   = port_info.value.port
      cidrs     = ["0.0.0.0/0"]
    }
  }
}
