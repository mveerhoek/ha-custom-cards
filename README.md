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
| **Custom Rows Card** | Responsive rows with sensors, switches and expandable controls (media player, climate, power switch, cover, light, sensors, consumption) |
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
| `uplink_speed` | Optional entity with the uplink speed. Shows a coloured square left of the restart button; hover to see the speed |
| `ports` | Optional list of ports, drawn as small squares on a second row below the device name |

### Link speed colours

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

### Ports

Each port supports the following options:

| Option | Description |
| :--- | :--- |
| `name` | Port name, shown in the tooltip |
| `number` | Port number, shown inside the square and in the tooltip |
| `speed` | Optional entity with the link speed of the port. Without it, or when the port is disconnected, the square is grey (`#4B5563`) |

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
    uplink_speed: sensor.switch_uplink_speed
    ports:
      - name: NAS
        number: 1
        speed: sensor.switch_port_1_speed
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

Displays one, two or four columns of entries, depending on the card width
(two columns from 340 px, four columns from 700 px). An expanded entry spans
the full width with one or two columns. With four columns it spans the two
leftmost or the two rightmost columns. The other two columns next to it are filled
with the other entries of the card, as many as fit next to the expanded entry, so
no empty space is left. If other entries are already in the row, the expanded entry
moves to the right and those entries (followed by the next ones) go to its left;
otherwise it is on the left and the following entries go to its right. The order of
the entries therefore only changes while an entry is expanded and returns when it is
collapsed.
Values that do not fit are hidden from the end of the
summary; clicking a displayed value opens its entity details.

| Entry option | Required | Description |
| :--- | :--- | :--- |
| `name`, `icon` | Yes | Display name and Material Design icon, e.g. `mdi:sofa` |
| `switch` | No | Switch, light or `input_select` toggled by clicking the entry icon (an `input_select` selects its next option on each click) |
| `state_colors` | No | Only with an `input_select` as `switch`: list of `{ state, color }` items. The icon takes the colour of the current option and the circle behind it a lighter shade of it; options without an item keep the default grey icon |
| `temperature`, `humidity`, `illuminance`, `pressure`, `power` | No | Sensor entities shown in that order |
| `value_order` | No | Order of sensor values for this entry; omitted values follow in the default order |
| `door` | No | Binary sensor: on shows an orange open-door badge, off a green closed-door badge |
| `extras` | No | List of expandable controls |

Each extra requires `type` and `entity` (except `sensors` and `consumption`,
which use `entities` and separate sensor options). `name` and `icon` override the entity name and icon. Supported types:

- `media_player`: the button on the left opens more-info; it shows the album
  artwork (or other graphic offered by the player) and falls back to the icon
  when there is none. The first line (bold) shows the title of the track (or the
  player name), the second line the artist, otherwise the source (e.g.
  `NPO Radio 2`), otherwise the state. On the right are a play/pause button and
  a volume button; the volume button replaces the player with a slider with a
  mute button on the left and a cancel button on the right. Optionally set
  `badge` (see [Badges](#badges)) to show a badge on the entry icon while the
  player is playing.
- `climate`: shows status and target temperature with plus/minus buttons;
  `step` sets the increment (default `0.5`). Long-press the extra to turn it on
  or off. A light-blue circle grows while pressing and briefly lights up when
  the action is triggered after 0.5 seconds. Releasing early, moving or
  scrolling cancels it; buttons do not trigger the long press. A heating or
  cooling badge appears on the entry icon (see [Badges](#badges)).
- `power_switch`: shows the switch state, optionally a `power` sensor and
  `status` binary sensor. Set `switchable: true` to enable control. Turning off
  a switch while its `status` sensor is on requires an inline confirmation;
  the prompt closes after five seconds. The name is always shown in regular
  weight; the state is indicated by the status icon. Optionally set
  `badge` (see [Badges](#badges)) to show a badge on the entry icon while the
  switch is on.
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

- `sensors`: a compact row showing up to 8 entities of any kind (temperature,
  humidity, power, a binary sensor, ...). Instead of `entity` it takes
  `entities`, a list of entity IDs or objects; items beyond the eighth are
  ignored. The row has a grey `mdi:thermometer` icon on the left (overridable
  with `icon`). An optional `label` on the row is shown in bold to the right
  of this icon. On the right every entity is shown as an icon,
  an optional label and its value. The value uses the unit of the entity itself
  and follows the display precision set in Home Assistant; entities without a
  numeric state show their (translated) state. The first entity is on the left,
  the last on the right. If they do not fit on one line they continue on the
  next line. Clicking an item opens its entity details. An item is either a
  plain entity ID or an object with these options:

  | Item option | Description |
  | :--- | :--- |
  | `entity` | Entity ID (required) |
  | `icon` | Optional icon that replaces the default `mdi:numeric-n-box` icon (`n` = 1-8, the position in the list). For a binary sensor this is the icon for `on` |
  | `icon_off` | Optional, binary sensors only: icon for `off` (default: the same as `icon`) |
  | `color` | Optional colour of the icon. For a binary sensor the colour is only shown while the sensor is `on`; when `off` the icon stays dark grey |
  | `hide_icon` | Set to `true` to show no icon for this item |
  | `label` | Optional label in regular weight, shown to the right of the icon and before the value. For a binary sensor only the label is shown, not the state |

- `consumption`: a compact row for energy, gas and water usage. It takes the
  options `energy_import`, `energy_export`, `gas` and `water` (all optional, at
  least one required) instead of `entity`. The row has a grey `mdi:counter` icon
  on the left (overridable with `icon`) and no label. On the right the
  configured values are shown from left to right in this fixed order: energy
  import (`mdi:transmission-tower-import`), energy export
  (`mdi:transmission-tower-export`), gas (`mdi:meter-gas`) and water (`mdi:water`),
  each with its value and unit. Values that are not configured are left out.
  If they do not fit on one line they continue on the next line. Clicking a
  value opens its entity details.

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
        badge:
          icon: mdi:music-note
          color: "#2196f3"
      - type: climate
        entity: climate.living_room
        step: 0.5
      - type: power_switch
        entity: switch.television_power
        power: sensor.television_power
        status: binary_sensor.television_active
        switchable: true
        badge:
          icon: mdi:television
          color: orange
      - type: cover
        entity: cover.living_room_sunscreen
        name: Sunscreen
      - type: light
        entity: light.living_room_lamp
        name: Floor lamp
      - type: sensors
        label: Climate
        entities:
          - sensor.living_room_temperature
          - entity: sensor.living_room_floor_temperature
            icon: mdi:floor-plan
          - entity: sensor.living_room_humidity
            hide_icon: true
            label: Humidity
          - entity: sensor.living_room_co2
            icon: mdi:molecule-co2
            label: CO2
      - type: consumption
        energy_import: sensor.energy_import_today
        energy_export: sensor.energy_export_today
        gas: sensor.gas_consumption_today
        water: sensor.water_consumption_today
```

An entry whose `switch` is an `input_select` can give every option its own colour:

```yaml
entries:
  - name: Scene
    icon: mdi:palette
    switch: input_select.living_room_scene
    state_colors:
      - state: Relax
        color: "#ff9800"
      - state: Movie
        color: "#3f51b5"
```

`value_order` is set per entry and accepts `temperature`, `humidity`,
`illuminance`, `pressure` and `power` once each. Leave it out for the default
order shown above. A partial list puts those values first and appends the other
configured values in default order. Unconfigured sensors are not displayed.

The card also supports `css_url` for an alternative shared stylesheet.

### Badges

Badges are small status icons shown in a corner of the entry icon: a coloured
circle with a white icon. An entry shows at most three badges, all on the right
side. They are filled in this order: top right, bottom right, middle right (with
three badges they overlap slightly). Badges are ordered as follows: climate,
door, then the `power_switch` and `media_player` badges in the order of the
extras.

| Badge | Shown when | Icon / colour |
| :--- | :--- | :--- |
| Climate (automatic for a `climate` extra) | The climate is heating or cooling | `mdi:heat-wave` in red when heating, `mdi:snowflake` in blue when cooling |
| Door (`door` option of the entry) | The binary sensor is available | `mdi:door-open` in orange when on (open), `mdi:door` in green when off (closed) |
| `power_switch` with `badge` | The switch is on | Configured icon and colour |
| `media_player` with `badge` | The player is playing | Configured icon and colour |

The `badge` option of a `power_switch` or `media_player` extra is optional; without
it no badge is shown. It has the following options:

| Option | Default | Description |
| :--- | :--- | :--- |
| `icon` | `mdi:flash` (`power_switch`), `mdi:play` (`media_player`) | Icon of the badge, e.g. `mdi:music-note` |
| `color` | `var(--primary-color)` | Colour of the circle: any CSS colour (`orange`, `#2196f3`) or Home Assistant variable. The icon itself is always white |

------------------------------------------------------------------------

## 5. Docker Combined Card

Displays Docker containers grouped by project, including CPU, memory and
network usage. Overview totals include running containers only; stopped or
unavailable containers contribute zero to totals.

The card automatically discovers containers based on their switch
entities (sorted alphabetically). Containers that are not assigned to a
configured project are automatically grouped under a virtual project
**Other**, which is hidden when it has no containers.

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
| `containers` | Yes | List of container names (at least one), without the entity prefix |

\*Provide either `name` or `project` for each project.

A container listed in a project is always shown, even if its entities do not
exist; its status is then shown as unknown.

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

The card header shows three things:

-   A subtitle such as *12 containers in 4 projects*. The number of projects
    includes **Other** when it has containers.
-   A second line with the total CPU and RAM usage of all running containers,
    in the same format as the Custom Desktop Card (`CPU 1.2 % · RAM 1234 MB`).
-   A status badge: *All running*, *x/y running*, *All stopped* or *No
    containers found*.

Click the header to show or hide the projects. Each project shows its name
and a status badge (*All running*, *x/y running* or *All stopped*) on the first
line, and its total CPU, RAM, Rx and Tx on the second line. Click a project to
show or hide its containers. Each container row shows an icon, the name, CPU,
RAM, the status (running, stopped or unknown) and an on/off toggle.

Containers can be started and stopped directly from the card using the
toggle. A confirmation is always requested first.

------------------------------------------------------------------------

## Translations

The interface follows the language configured in Home Assistant. English and
Dutch are included in `dist/custom-cards-translations/`. English is the fallback
for missing files and keys; a regional language file overrides its base language,
which overrides English. Add a `<language>.json` file in that directory to add a
language. Preserve keys, placeholders such as `{name}` and plural suffixes such
as `_one` and `_other`.

All text shown in the interface comes from these files: labels, status
texts, confirmation questions, error messages, the card picker texts, the
visual editor and the accessibility labels (`aria-label`) of buttons and
sliders. Keys are grouped by prefix (`status.`, `label.`, `docker.`,
`rows.`, `error.`, `editor.`, `card.`); every key must exist in `en.json`,
other language files may leave out keys. Configured names, entity
values and custom confirmation messages remain as supplied by the user or
Home Assistant. Symbols and units (`·`, `—`, `%`, `°C`, `W`, `kWh`, `m³`)
are not translated.

## Visual editor

Every card has a visual editor. Single options such as entities and names are
form fields; lists (`networks`, `devices`, `volumes`, `projects` and `entries`)
are edited as YAML in an object field. A list must start with a dash (`- `);
otherwise a warning is shown and the change is not applied. Where available,
the editor also contains an example of the lists in YAML. Editor labels and
help texts are translated like the rest of the interface.

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
