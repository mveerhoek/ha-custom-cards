# Home Assistant Custom Cards

A collection of compact custom cards for Home Assistant. The cards
display information about your network infrastructure, Synology NAS,
desktop computer and Docker containers.

All cards share a common base library and stylesheet, providing a
consistent appearance and centralised handling of commonly used
functionality.

## Contents

  -----------------------------------------------------------------------
  Card                                Description
  ----------------------------------- -----------------------------------
  **Custom Network Infrastructure     Router status, networks, connected
  Card**                              users and network devices

  **Synology NAS Card**               NAS status, system usage, network
                                      traffic, volumes and disks

  **Custom Desktop Card**             Desktop computer status and
                                      performance

  **Docker Combined Card**            Overview of Docker containers,
                                      grouped by project
  -----------------------------------------------------------------------

## Installation

1.  Open **HACS** in Home Assistant.
2.  Add this repository via **Custom repositories**.
3.  Select **Dashboard** as the category.
4.  Install the repository.
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

  ------------------------------------------------------------------------
  Option                   Required                Description
  ------------------------ ----------------------- -----------------------
  `name`                   Yes                     Card title

  `router_status_entity`   No                      Entity used to
                                                   determine the router
                                                   status (`on` = Online,
                                                   `off` = Offline)

  `wan_ip_tracker`         No                      `device_tracker` entity
                                                   used to retrieve the
                                                   WAN IP address

  `networks`               No                      List of network
                                                   connections

  `devices`                No                      List of network devices

  `css_url`                No                      Alternative path to the
                                                   shared stylesheet
  ------------------------------------------------------------------------

### Networks

Each network supports the following options:

  -----------------------------------------------------------------------
  Option                              Description
  ----------------------------------- -----------------------------------
  `name`                              Displayed network name

  `type`                              `wlan` for Wi-Fi; any other value
                                      is treated as Ethernet

  `connected_users`                   Entity containing the number of
                                      connected users, or a list of
                                      numeric entities whose values are
                                      added together
  -----------------------------------------------------------------------

### Devices

Each device supports the following options:

  -----------------------------------------------------------------------
  Option                              Description
  ----------------------------------- -----------------------------------
  `name`                              Device name

  `type`                              `router`, `switch`, `ap` or
                                      `accesspoint`

  `ip`                                Static IP address used as a
                                      fallback

  `device_tracker`                    Optional entity used to dynamically
                                      retrieve the IP address from its
                                      `ip` attribute

  `cpu`                               CPU usage sensor

  `memory`                            RAM usage sensor

  `restart_action`                    Optional action for the restart
                                      button
  -----------------------------------------------------------------------

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

  Option          Required   Description
  --------------- ---------- -------------------------------------------
  `name`          Yes        NAS name
  `temperature`   No         NAS temperature sensor
  `security`      No         Entity representing the security status
  `cpu`           No         CPU usage sensor
  `memory`        No         RAM usage sensor
  `network_rx`    No         Incoming network traffic sensor
  `network_tx`    No         Outgoing network traffic sensor
  `volumes`       No         List of storage volumes
  `css_url`       No         Alternative path to the shared stylesheet

### Volumes

Each volume supports the following options:

  Option     Description
  ---------- ---------------------------------------
  `name`     Volume name
  `used`     Sensor for used storage capacity
  `size`     Sensor for total storage capacity
  `status`   Entity representing the volume status
  `disks`    List of associated disks

### Disks

Each disk supports the following options:

  Option          Description
  --------------- -------------------------------------
  `name`          Disk name
  `type`          `ssd` or `hdd`
  `temperature`   Disk temperature sensor
  `status`        Entity representing the disk status

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

  -----------------------------------------------------------------------
  Option                  Required                Description
  ----------------------- ----------------------- -----------------------
  `name`                  Yes                     Computer name

  `device_tracker`        No                      Entity used to
                                                  determine the
                                                  online/offline status

  `cpu`                   No                      CPU usage sensor

  `memory`                No                      RAM usage sensor

  `temperature`           No                      Temperature sensor

  `storage_used`          No                      Used storage capacity
                                                  sensor

  `storage_free`          No                      Available storage
                                                  capacity sensor

  `css_url`               No                      Alternative path to the
                                                  shared stylesheet
  -----------------------------------------------------------------------

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

## 4. Docker Combined Card

Displays Docker containers grouped by project, including CPU, memory and
network usage.

The card automatically discovers containers based on their switch
entities. Containers that are not assigned to a configured project are
automatically grouped under **Other**.

### Configuration options

  ------------------------------------------------------------------------
  Option            Required          Default            Description
  ----------------- ----------------- ------------------ -----------------
  `projects`        No                `[]`               List of Docker
                                                         projects

  `entity_prefix`   No                `unraid_docker_`   Prefix used by
                                                         Docker entities

  `css_url`         No                Automatic          Alternative path
                                                         to the shared
                                                         stylesheet
  ------------------------------------------------------------------------

Each project supports:

  Option         Required   Description
  -------------- ---------- -------------------------
  `name`         Yes\*      Displayed project name
  `project`      Yes\*      Alternative to `name`
  `containers`   Yes        List of container names

\*Provide either `name` or `project` for each project.

### Expected entities

For a container named `nextcloud` and the default prefix
`unraid_docker_`, the card expects the following entities:

  Function           Entity
  ------------------ -----------------------------------------------
  On/off status      `switch.unraid_docker_nextcloud`
  CPU usage          `sensor.unraid_docker_nextcloud_cpu`
  Memory usage       `sensor.unraid_docker_nextcloud_memory_usage`
  Network received   `sensor.unraid_docker_nextcloud_network_rx`
  Network sent       `sensor.unraid_docker_nextcloud_network_tx`

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
