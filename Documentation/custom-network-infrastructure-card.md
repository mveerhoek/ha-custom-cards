# Custom Network Infrastructure Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

Displays the router status, connected users and an expandable list of
network devices.

## Configuration options

| Option | Required | Description |
| :--- | :--- | :--- |
| `name` | Yes | Card title |
| `router_status_entity` | No | Entity used to determine the router status (`on` = Online, `off` = Offline) |
| `wan_ip_tracker` | No | `device_tracker` entity used to retrieve the WAN IP address |
| `networks` | No | List of network connections |
| `devices` | No | List of network devices |
| `css_url` | No | Alternative path to the shared stylesheet |

## Networks

Each network supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Displayed network name |
| `type` | `wlan` for Wi-Fi; any other value is treated as Ethernet |
| `connected_users` | Entity containing the number of connected users, or a list of numeric entities whose values are added together |

## Devices

Each device supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Device name |
| `type` | `router`, `switch`, `ap` or `accesspoint` |
| `ip` | Static IP address used as a fallback |
| `device_tracker` | Optional entity used to dynamically retrieve the IP address from its `ip` attribute |
| `cpu` | CPU usage sensor |
| `memory` | RAM usage sensor |
| `restart_action` | Optional action for the restart button |
| `uplink_speed` | Optional entity with the uplink speed. Shows a coloured square left of the restart button; hover to see the speed |
| `ports` | Optional list of ports, drawn as small squares on a second row below the device name |

## Link speed colours

The uplink square and the port squares use the same colours. The value is read
from the entity state in Mbit/s (`1000`), or with a unit (`1 Gbps`, `2,5 Gbit/s`,
or the `unit_of_measurement` attribute). A value that is unknown, unavailable,
not a number or below 10 Mbit/s is shown as disconnected.

The colours follow the Home Assistant theme (dark or light) and change
immediately when the theme is switched.

| Speed | Dark theme | Light theme |
| :--- | :--- | :--- |
| 10 Mbit/s | `#D97706` | `#E06D06` |
| 100 Mbit/s | `#EAB308` | `#F59E0B` |
| 1 Gbit/s | `#00A859` | `#10B981` |
| 2.5 Gbit/s | `#00A0DF` | `#06B6D4` |
| 5 Gbit/s | `#006FFF` | `#3B82F6` |
| 10 Gbit/s | `#4F46E5` | `#2563EB` |
| Disconnected | `#4B5563` | `#9CA3AF` |

The uplink square and every port square are clickable when an entity is
configured: a click opens the entity details with its history.

## Ports

Each port supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Port name, shown in the tooltip |
| `number` | Port number, shown inside the square and in the tooltip |
| `speed` | Optional entity with the link speed of the port. Without it, or when the port is disconnected, the square is grey (`#4B5563`) |
| `poe_power` | Optional entity with the PoE power of the port. When the value is greater than 0, the tooltip gets `, <power> <unit>` after the link speed and a `mdi:lightning-bolt` icon replaces the port number |

## Example

``` yaml
type: custom:custom-network-infrastructure-card
name: Network
router_status_entity: binary_sensor.router_status
wan_ip_tracker: device_tracker.wan_ip

networks:
  - name: LAN
    type: ethernet
    connected_users: sensor.lan_users

  - name: Wi-Fi
    type: wlan
    connected_users:
      - sensor.wifi_2ghz_users
      - sensor.wifi_5ghz_users

devices:
  - name: Router
    type: router
    ip: 192.168.1.1
    cpu: sensor.router_cpu
    memory: sensor.router_memory

  - name: Switch
    type: switch
    ip: 192.168.1.2
    uplink_speed: sensor.switch_uplink_speed
    ports:
      - name: NAS
        number: 1
        speed: sensor.switch_port_1_speed
        poe_power: sensor.switch_port_1_poe_power
      - name: Access point
        number: 2
        speed: sensor.switch_port_2_speed
      - name: Unused
        number: 3
```

The device list can be expanded by clicking the card header. CPU and RAM
values are clickable and open the corresponding entity details.

A `restart_action` can be used to execute a Home Assistant action.
Service actions ask for confirmation by default. This can be customised
using `confirmation: false` or a custom confirmation message.
