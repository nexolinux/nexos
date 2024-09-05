#!/usr/bin/env bash
# shellcheck disable=SC2034

iso_name="nexos"
iso_label="nexos_$(date +%Y%m)"
iso_publisher="Nexus https://nexus-security-club.com/"
iso_application="NEXOS Live/Rescue CD"
iso_version="$(date +%Y.%m)"
install_dir="arch"
bootmodes=('bios.syslinux.mbr' 'bios.syslinux.eltorito' 'uefi-ia32.grub.esp' 'uefi-x64.grub.esp' 'uefi-ia32.grub.eltorito' 'uefi-x64.grub.eltorito')
arch="x86_64"
pacman_conf="pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'xz' '-Xbcj' 'x86' '-b' '1M' '-Xdict-size' '1M')
file_permissions=(
  ["/etc/shadow"]="0:0:400"
  ["/root"]="0:0:750"
  ["/root/.automated_script.sh"]="0:0:755"
  ["/usr/local/bin/choose-mirror"]="0:0:755"
  ["/usr/local/bin/Installation_guide"]="0:0:755"
  ["/usr/local/bin/livecd-sound"]="0:0:755"
  ["/usr/local/bin/nexos-preset"]="0:0:755"
  ["/usr/local/bin/nexos-finalisation"]="0:0:755"
  ["/etc/skel/.cache/gitstatus/gitstatusd-linux-x86_64"]="0:0:755"
)
