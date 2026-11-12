# Docker Combined Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

Displays Docker containers grouped by project, including CPU, memory and
network usage. Overview totals include running containers only; stopped or
unavailable containers contribute zero to totals.

The card automatically discovers containers based on their switch
entities (sorted alphabetically). Containers that are not assigned to a
configured project are automatically grouped under a virtual project
**Other**, which is hidden when it has no containers.

## Configuration options

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

## Expected entities

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

## Example

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
