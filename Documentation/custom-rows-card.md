# Custom Rows Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

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

## Badges

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
