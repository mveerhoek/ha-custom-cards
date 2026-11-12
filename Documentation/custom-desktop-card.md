# Custom Desktop Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

A compact card for monitoring a desktop computer.

## Configuration options

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

## Example

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
