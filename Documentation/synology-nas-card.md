# Synology NAS Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

Displays key status information for a Synology NAS, including storage
volumes and individual disks.

## Configuration options

| Option | Required | Description |
| :--- | :--- | :--- |
| `name` | Yes | NAS name |
| `temperature` | No | NAS temperature sensor |
| `security` | No | Entity representing the security status |
| `cpu` | No | CPU usage sensor |
| `memory` | No | RAM usage sensor |
| `network_rx` | No | Incoming network traffic sensor |
| `network_tx` | No | Outgoing network traffic sensor |
| `volumes` | No | List of storage volumes |
| `css_url` | No | Alternative path to the shared stylesheet |

## Volumes

Each volume supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Volume name |
| `used` | Sensor for used storage capacity |
| `size` | Sensor for total storage capacity |
| `status` | Entity representing the volume status |
| `disks` | List of associated disks |

## Disks

Each disk supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Disk name |
| `type` | `ssd` or `hdd` |
| `temperature` | Disk temperature sensor |
| `status` | Entity representing the disk status |

If Home Assistant device metadata is available, the manufacturer and
model are automatically displayed after the disk name.

## Example

``` yaml
type: custom:synology-nas-card
name: Synology NAS

temperature: sensor.nas_temperature
security: binary_sensor.nas_security_status
cpu: sensor.nas_cpu_utilization
memory: sensor.nas_memory_usage
network_rx: sensor.nas_network_down
network_tx: sensor.nas_network_up

volumes:
  - name: Volume 1
    used: sensor.nas_volume_1_used
    size: sensor.nas_volume_1_total
    status: sensor.nas_volume_1_status

    disks:
      - name: Disk 1
        type: hdd
        temperature: sensor.disk_1_temperature
        status: sensor.disk_1_status

      - name: Disk 2
        type: hdd
        temperature: sensor.disk_2_temperature
        status: sensor.disk_2_status

  - name: Volume 2
    used: sensor.nas_volume_2_used
    size: sensor.nas_volume_2_total
    status: sensor.nas_volume_2_status

    disks:
      - name: SSD 1
        type: ssd
        temperature: sensor.ssd_1_temperature
        status: sensor.ssd_1_status
```

Volumes can be expanded individually to display their associated disks.
Disk temperatures and CPU, RAM and network values are also clickable.

The overall NAS status is determined by the security status and the
status of all configured volumes and disks.
