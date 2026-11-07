# Home Assistant Custom Cards

A collection of compact custom cards for Home Assistant. The cards
display information about your network infrastructure, Synology NAS,
desktop computer and Docker containers.

All cards share a common base library and stylesheet, providing a
consistent appearance and centralised handling of commonly used
functionality.

## Contents

| Card | Description |
| :--- | :--- |
| **Custom Network Infrastructure Card** | Router status, networks, connected users and network devices |
| **Synology NAS Card** | NAS status, system usage, network traffic, volumes and disks |
| **Custom Desktop Card** | Desktop computer status and performance |
| **Custom Rows Card** | Responsive rows with sensors, switches and expandable controls (media player, climate, power switch, cover, light, temperatures) |
| **Docker Combined Card** | Overview of Docker containers, grouped by project |

## Installation

1.  Open **HACS** in Home Assistant.
2.  Add this repository via **Custom repositories**.
3.  Select **Dashboard** as the category.
4.  Install the repository. Ensure the dashboard resource points to
    `/hacsfiles/ha-custom-cards/ha-custom-cards.js` as a JavaScript module
    (adjust the path if your repository has a different HACS name). Keep the
    other files and translation directory next to it.
5.  Add the card to your dashboard using the visual editor or YAML
    configuration.

## File structure

The repository is organised as follows:

``` text
ha-custom-cards/
├── hacs.json
├── README.md
└── dist/
    ├── ha-custom-cards.js
    ├── custom-cards-shared.js
    ├── custom-cards-shared.css
    ├── custom-network-infrastructure-card.js
    ├── synology-nas-card.js
    ├── custom-desktop-card.js
    ├── custom-rows-card.js
    ├── custom-cards-translations/
    │   ├── en.json
    │   └── nl.json
    └── docker-combined-card.js
```

-   **ha-custom-cards.js** -- central entry point that loads all cards.
-   **custom-cards-shared.js** -- shared functionality, including the
    base class, entity handling, status badges and actions.
-   **custom-cards-shared.css** -- shared styling.
-   The remaining JavaScript files contain the individual cards.

The cards are separate components but rely on the shared files. Only
load the central `ha-custom-cards.js` file, not the individual card
files.

------------------------------------------------------------------------

# Card configuration

All examples below use the YAML configuration format for Home Assistant
dashboards.

## 1. Custom Network Infrastructure Card

Displays the router status, connected users and an expandable list of
network devices.

### Configuration options

| Option | Required | Description |
| :--- | :--- | :--- |
| `name` | Yes | Card title |
| `router_status_entity` | No | Entity used to determine the router status (`on` = Online, `off` = Offline) |
| `wan_ip_tracker` | No | `device_tracker` entity used to retrieve the WAN IP address |
| `networks` | No | List of network connections |
| `devices` | No | List of network devices |
| `css_url` | No | Alternative path to the shared stylesheet |

### Networks

Each network supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Displayed network name |
| `type` | `wlan` for Wi-Fi; any other value is treated as Ethernet |
| `connected_users` | Entity containing the number of connected users, or a list of numeric entities whose values are added together |

### Devices

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

### Example

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
```

The device list can be expanded by clicking the card header. CPU and RAM
values are clickable and open the corresponding entity details.

A `restart_action` can be used to execute a Home Assistant action.
Service actions ask for confirmation by default. This can be customised
using `confirmation: false` or a custom confirmation message.

------------------------------------------------------------------------

## 2. Synology NAS Card

Displays key status information for a Synology NAS, including storage
volumes and individual disks.

### Configuration options

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

### Volumes

Each volume supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Volume name |
| `used` | Sensor for used storage capacity |
| `size` | Sensor for total storage capacity |
| `status` | Entity representing the volume status |
| `disks` | List of associated disks |

### Disks

Each disk supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Disk name |
| `type` | `ssd` or `hdd` |
| `temperature` | Disk temperature sensor |
| `status` | Entity representing the disk status |

If Home Assistant device metadata is available, the manufacturer and
model are automatically displayed after the disk name.

### Example

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

------------------------------------------------------------------------

## 3. Custom Desktop Card

A compact card for monitoring a desktop computer.

### Configuration options

| Option | Required | Description |
| :--- | :--- | :--- |
| `name` | Yes | Computer name |
| `device_tracker` | No | Entity used to determine the online/offline status |
| `cpu` | No | CPU usage sensor |
| `memory` | No | RAM usage sensor |
| `temperature` | No | Temperature sensor |
| `storage_used` | No | Used storage capacity sensor |
| `storage_free` | No | Available storage capacity sensor |
| `css_url` | No | Alternative path to the shared stylesheet |

### Example

``` yaml
type: custom:custom-desktop-card
name: Desktop

device_tracker: device_tracker.desktop
cpu: sensor.desktop_cpu
memory: sensor.desktop_memory
temperature: sensor.desktop_temperature
storage_used: sensor.desktop_storage_used
storage_free: sensor.desktop_storage_free
```

The card displays:

-   Online/offline status.
-   CPU and RAM usage.
-   Temperature.
-   Used and total storage capacity.

Total storage capacity is calculated by adding `storage_used` and
`storage_free`. The unit is taken from the used-storage sensor.

The status is determined using the `device_tracker` entity:

-   `home`, `on` or `connected` = Online.
-   `not_home`, `off` or `disconnected` = Offline.
-   Other or unavailable values = Unknown.

------------------------------------------------------------------------

## 4. Custom Rows Card

Displays one or two columns of entries, depending on the card width. An
expanded entry spans the full width. Values that do not fit are hidden from
the end of the summary; clicking a displayed value opens its entity details.

| Entry option | Required | Description |
| :--- | :--- | :--- |
| `name`, `icon` | Yes | Display name and Material Design icon, e.g. `mdi:sofa` |
| `switch` | No | Switch or light toggled by clicking the entry icon |
| `temperature`, `humidity`, `illuminance`, `pressure`, `power` | No | Sensor entities shown in that order |
| `value_order` | No | Order of sensor values for this entry; omitted values follow in the default order |
| `door` | No | Binary sensor: on/off displays an open/closed door badge |
| `extras` | No | List of expandable controls |

Each extra requires `type` and `entity` (except `temperatures`, which uses
`entities`). `name` and `icon` override the entity name and icon. Supported types:

- `media_player`: opens more-info from the icon; includes play/pause, volume,
  mute and album artwork when available.
- `climate`: shows status and target temperature with plus/minus buttons;
  `step` sets the increment (default `0.5`). Long-press the extra to turn it on
  or off. A light-blue circle grows while pressing and briefly lights up when
  the action is triggered after 0.5 seconds. Releasing early, moving or
  scrolling cancels it; buttons do not trigger the long press. A heating or
  cooling badge may appear on the entry icon.
- `power_switch`: shows the switch state, optionally a `power` sensor and
  `status` binary sensor. Set `switchable: true` to enable control. Turning off
  a switch while its `status` sensor is on requires an inline confirmation;
  the prompt closes after five seconds. The name is bold only while the `status`
  binary sensor is on; otherwise it is shown in regular weight.
- `cover`: controls a cover (e.g. sunscreen or blinds). The button on the left
  (`mdi:window-open`) toggles between open and closed. Next to it the name is
  shown in bold, with the state and, when the cover reports a position, how far
  it is open (e.g. `Open · 40%`) below it. On the right are buttons to close
  (`mdi:arrow-down`), open (`mdi:arrow-up`) and to switch the row to a slider
  (`mdi:gesture-swipe-horizontal`). The slider spans the full row and sets the
  percentage the cover is open; the button on its right
  (`mdi:gesture-tap-button`) returns to the normal row. The slider requires a
  cover that reports `current_position`. The close and open buttons are
  disabled while the cover is already fully closed or open.
- `light`: controls a light. A compact row with the icon (`mdi:lightbulb`,
  overridable with `icon`), the name (overridable with `name`) and a toggle on
  the right. When the light is on, the icon takes the colour of the light
  (`rgb_color`), or orange if it has no colour (e.g. a `switch` entity); when off
  the icon is grey. The
  toggle shows `mdi:toggle-switch-variant` in green when on and
  `mdi:toggle-switch-variant-off` in grey when off. Clicking it switches the light.
  If the light supports colour or colour temperature, a square button showing
  the current colour of the light (light-grey 1 px border) appears to the left of
  the toggle; it opens the standard Home Assistant dialog of the light. If the
  brightness can be set, a button (`mdi:gesture-swipe-horizontal`) to the left of
  that replaces the row with a full-width brightness slider (0% switches the
  light off). The button on its right (`mdi:gesture-tap-button`) restores the row.
  If the brightness can be set, a second line below the name (regular weight)
  shows the brightness as a percentage.
- `temperatures`: a compact row showing up to 8 temperature sensors. Instead of
  `entity` it takes `entities`, a list of sensor entities; sensors beyond the
  eighth are ignored. The row has a grey `mdi:thermometer` icon on the left
  (overridable with `icon`) and no label. On the right every sensor is shown as
  an `mdi:numeric-n-box` icon followed by its temperature, where `n` (1-8) is the
  position in the list: the first sensor is on the left, the last on the right.
  If the sensors do not fit on one line they continue on the next line.
  Clicking a sensor opens its entity details.

```yaml
type: custom:custom-rows-card
entries:
  - name: Living room
    icon: mdi:sofa
    switch: light.living_room
    temperature: sensor.living_room_temperature
    humidity: sensor.living_room_humidity
    value_order: [humidity, temperature]
    door: binary_sensor.living_room_door
    extras:
      - type: media_player
        entity: media_player.living_room
      - type: climate
        entity: climate.living_room
        step: 0.5
      - type: power_switch
        entity: switch.television_power
        power: sensor.television_power
        status: binary_sensor.television_active
        switchable: true
      - type: cover
        entity: cover.living_room_sunscreen
        name: Sunscreen
      - type: light
        entity: light.living_room_lamp
        name: Floor lamp
      - type: temperatures
        entities:
          - sensor.living_room_temperature
          - sensor.living_room_floor_temperature
          - sensor.living_room_window_temperature
```

`value_order` is set per entry and accepts `temperature`, `humidity`,
`illuminance`, `pressure` and `power` once each. Leave it out for the default
order shown above. A partial list puts those values first and appends the other
configured values in default order. Unconfigured sensors are not displayed.

The card also supports `css_url` for an alternative shared stylesheet.

------------------------------------------------------------------------

## 5. Docker Combined Card

Displays Docker containers grouped by project, including CPU, memory and
network usage. Overview totals include running containers only; unavailable
values contribute zero to totals.

The card automatically discovers containers based on their switch
entities. Containers that are not assigned to a configured project are
automatically grouped under **Other**.

### Configuration options

| Option | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `projects` | No | `[]` | List of Docker projects |
| `entity_prefix` | No | `unraid_docker_` | Prefix used by Docker entities |
| `css_url` | No | Automatic | Alternative path to the shared stylesheet |

Each project supports:

| Option | Required | Description |
| :--- | :--- | :--- |
| `name` | Yes\* | Displayed project name |
| `project` | Yes\* | Alternative to `name` |
| `containers` | Yes | List of container names |

\*Provide either `name` or `project` for each project.

### Expected entities

For a container named `nextcloud` and the default prefix
`unraid_docker_`, the card expects the following entities:

| Function | Entity |
| :--- | :--- |
| On/off status | `switch.unraid_docker_nextcloud` |
| CPU usage | `sensor.unraid_docker_nextcloud_cpu` |
| Memory usage | `sensor.unraid_docker_nextcloud_memory_usage` |
| Network received | `sensor.unraid_docker_nextcloud_network_rx` |
| Network sent | `sensor.unraid_docker_nextcloud_network_tx` |

Change `entity_prefix` if your entities use a different prefix.

### Example

``` yaml
type: custom:docker-combined-card
entity_prefix: unraid_docker_

projects:
  - name: Media
    containers:
      - plex
      - sonarr
      - radarr

  - name: Home Automation
    containers:
      - homeassistant
      - mosquitto
      - zigbee2mqtt

  - name: Utilities
    containers:
      - adguardhome
      - vaultwarden
      - bookstack
```

The card displays an overview of all discovered containers, including
the number of running containers and total CPU and memory usage.

The project list and individual container rows can be expanded and
collapsed. Containers can be started and stopped directly from the card.
Confirmation is requested by default.

------------------------------------------------------------------------

## Translations

The interface follows the language configured in Home Assistant. English and
Dutch are included in `dist/custom-cards-translations/`. English is the fallback
for missing files and keys; a regional language file overrides its base language,
which overrides English. Add a `<language>.json` file in that directory to add a
language. Preserve keys, placeholders such as `{name}` and plural suffixes such
as `_one` and `_other`. Configured names, entity values and custom confirmation
messages remain as supplied by the user or Home Assistant.

## General information

-   All cards read their values directly from Home Assistant entities.
-   Missing or unavailable sensor values are displayed as `Unknown` or
    `—`.
-   Clickable values open the standard Home Assistant more-info dialog.
-   The cards use a shared stylesheet and support an optional `css_url`
    to specify an alternative stylesheet location.
-   Entity IDs must match the entities available in your Home Assistant
    installation.

## Updates

Updates are distributed through HACS. After a new GitHub release is
published, the update can be installed through HACS.
