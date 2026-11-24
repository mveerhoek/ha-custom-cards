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

Each extra requires `type` and `entity` (except `sensors`, `consumption` and
`bambu_print`, which use `entities` and separate sensor options, and `image`, which
uses `image`). `name` and `icon` override the entity name and icon. Supported types:

- `media_player`: the button on the left opens more-info; it shows the album
  artwork (or other graphic offered by the player) and falls back to the icon
  when there is none. The first line (bold) shows the title of the track (or the
  player name), the second line the artist, otherwise the source (e.g.
  `NPO Radio 2`), otherwise the state. On the right are a play/pause button and
  a volume button; the volume button replaces the player with a slider with a
  mute button on the left and a cancel button on the right. Optionally set
  `badge` (see [Badges](#badges)) to show a badge on the entry icon while the
  player is playing.
- `climate`: shows status and target temperature, right-aligned. Click the
  temperature to open a pop-up with the minus button, the temperature and the
  plus button on one line; the temperature is only set, and the pop-up only
  closes, when you press Confirm (Cancel or Escape discards the change). `step`
  sets the increment (default `0.5`). The button left of the temperature
  (`mdi:air-filter`) opens a pop-up with a dropdown of the available presets
  (`preset_modes`) of the climate; choosing one applies it directly. The button
  is hidden when the climate has no presets. The active preset is also shown
  after the state in the second line (e.g. `Heating · Powerful`), except for
  `none`. Long-press the extra to turn it on or off. A light-blue circle grows
  while pressing and briefly lights up when the action is triggered after 0.5
  seconds. Releasing early, moving or scrolling cancels it; buttons do not
  trigger the long press. A heating or cooling badge appears on the entry icon
  (see [Badges](#badges)).
- `power_switch`: shows the switch state, optionally a `power` sensor and
  `status` binary sensor. Set `switchable: true` to enable control. Turning off
  a switch while its `status` sensor is on requires an inline confirmation;
  the prompt closes after five seconds. The name is always shown in regular
  weight; the state is indicated by the status icon. Optionally set
  `badge` (see [Badges](#badges)) to show a badge on the entry icon while the
  switch is on; with `use_status: true` in the badge it follows the `status`
  binary sensor instead of the switch.
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

- `bambu_print`: shows the current print of a Bambu Lab printer (ha-bambulab
  integration) as up to three rows under the entry, in the same style as the
  other extras. Instead of `entity` it takes separate entity options, all
  optional but at least one is required. An option without an entity is left
  out, and a row without any values is not shown at all. With a `status` entity
  the temperature and print rows are also hidden while the printer is not busy
  (not running, paused or preparing) and the nozzle is below 35 degrees, because
  they are not relevant then. They return as soon as a print starts or the nozzle
  is warmer than that. Without a `status` entity they are always shown.
  - **Header:** the printer icon (`mdi:printer-3d`, overridable with `icon`;
    orange while printing, yellow while paused, otherwise grey) and the name
    (overridable with `name`). The second line shows the state of the `status`
    entity, followed by the progress in percent while a print is active. On
    the right are buttons to open the camera stream (`mdi:video`), to pause or
    resume the print (`mdi:pause` / `mdi:play`) and to stop it (`mdi:stop`).
  - **Temperatures:** the nozzle (`mdi:printer-3d-nozzle-heat`) and the bed
    (`mdi:heating-coil`) as `current / target`, e.g. `215 / 220 °C`.
  - **Print:** the layer (`mdi:layers-outline`) as `current / total`, the
    remaining time (`mdi:timer-sand`) and the speed profile (`mdi:speedometer`).
    If they do not fit on one line they continue on the next line.

  The camera button opens the standard Home Assistant dialog of the `camera`
  entity, which shows the stream. With a `status` entity only one of the pause
  and resume buttons is shown at a time: pause while the print is running and
  resume while it is paused. Pause and resume are disabled in every other state,
  and stop is only enabled while a print is running, paused or being prepared.
  Without a `status` entity both buttons are always shown and only the
  availability of their button entity decides whether they are enabled.
  Pausing, resuming and stopping each ask for an inline confirmation first, like
  turning off a `power_switch`; the prompt closes after five seconds. Clicking a value opens
  its entity details. The remaining time uses the unit of the sensor (seconds,
  minutes, hours or days; minutes when it has none) and is shown as hours and
  minutes.

  | Option | ha-bambulab entity | Description |
  | :--- | :--- | :--- |
  | `status` | `sensor.<printer>_print_status` | State of the print; decides which pause/resume button is shown and when stop is enabled |
  | `progress` | `sensor.<printer>_print_progress` | Progress in percent, shown after the status |
  | `camera` | `camera.<printer>_camera` | Button that opens the camera stream |
  | `pause` | `button.<printer>_pause_printing` | Button entity that pauses the print |
  | `resume` | `button.<printer>_resume_printing` | Button entity that resumes the print |
  | `stop` | `button.<printer>_stop_printing` | Button entity that stops the print, after confirmation |
  | `nozzle_temperature`, `nozzle_target` | `sensor.<printer>_nozzle_temperature`, `sensor.<printer>_target_nozzle_temperature` | Nozzle temperature and target temperature |
  | `bed_temperature`, `bed_target` | `sensor.<printer>_bed_temperature`, `sensor.<printer>_target_bed_temperature` | Bed temperature and target temperature |
  | `speed` | `sensor.<printer>_speed_profile` | Print speed profile |
  | `layer`, `total_layers` | `sensor.<printer>_current_layer`, `sensor.<printer>_total_layer_count` | Current layer and total number of layers |
  | `remaining_time` | `sensor.<printer>_remaining_time` | Remaining print time |

- `camera`: a compact row with the icon (`mdi:camera`, overridable with `icon`),
  the name in bold (overridable with `name`, otherwise the name of the entity) and, on
  the far right, a button (`mdi:video`) that opens the camera stream: the standard
  Home Assistant dialog of the `camera` entity, just like the camera button of
  `bambu_print`. The button is disabled while the entity is missing or unavailable.

- `image`: shows a static image over the full width of the row, with the height
  following the proportions of the image. Instead of `entity` it takes `image`
  (required); `name` is optional and is used as the alternative text and tooltip. The row
  stays hidden until the image has loaded; if it cannot be loaded the row stays hidden
  and a message is written to the browser console. `image` accepts these forms:

  | Value | Description |
  | :--- | :--- |
  | `media/Latest/placeholder.jpg` | Short form: a file in the `media` folder of Home Assistant (media source `local`). Folders may be nested, e.g. `media/test/Latest/placeholder.jpg` |
  | `/media/local/Latest/placeholder.jpg` | The URL shown in the media browser. The first part after `/media/` is the media source, so `local` is required |
  | `media-source://media_source/local/Latest/placeholder.jpg` | The full media source address, for media sources other than `local` |
  | `/local/image.jpg`, `https://example.com/image.jpg` | A file in the `www` folder or any other URL, used as is |

  Files in the media folder are protected by Home Assistant authentication, so the
  card asks Home Assistant for a signed URL (`media_source/resolve_media`) and
  renews it every hour. The new image is loaded in the background first, so it does not
  flicker, and a new file under the same name therefore appears within the hour. If
  retrieving the URL fails, the card tries again after a minute. File and folder names
  are case-sensitive.

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
          use_status: true # badge follows the status sensor instead of the switch
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

A Bambu Lab printer in its own entry:

```yaml
type: custom:custom-rows-card
entries:
  - name: Printer room
    icon: mdi:printer-3d
    extras:
      - type: bambu_print
        name: Bambu P1S
        status: sensor.p1s_print_status
        progress: sensor.p1s_print_progress
        camera: camera.p1s_camera
        pause: button.p1s_pause_printing
        resume: button.p1s_resume_printing
        stop: button.p1s_stop_printing
        nozzle_temperature: sensor.p1s_nozzle_temperature
        nozzle_target: sensor.p1s_target_nozzle_temperature
        bed_temperature: sensor.p1s_bed_temperature
        bed_target: sensor.p1s_target_bed_temperature
        speed: sensor.p1s_speed_profile
        layer: sensor.p1s_current_layer
        total_layers: sensor.p1s_total_layer_count
        remaining_time: sensor.p1s_remaining_time
```

A camera and an image in their own entry:

```yaml
type: custom:custom-rows-card
entries:
  - name: Front door
    icon: mdi:door
    extras:
      - type: camera
        entity: camera.front_door
        name: Front door camera
      - type: image
        image: media/Latest/placeholder.jpg
        name: Latest snapshot
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

## Extras files

The extras are not part of `custom-rows-card.js`. Every type has its own file in
`dist/custom-rows-extras/`, which is imported by `ha-custom-cards.js`:

| Type | File |
| :--- | :--- |
| `media_player` | `media.js` |
| `climate` | `climate.js` |
| `cover` | `cover.js` |
| `light` | `light.js` |
| `power_switch` | `power-switch.js` |
| `sensors`, `consumption` | `sensors.js` |
| `bambu_print` | `bambu.js` |
| `camera` | `camera.js` |
| `image` | `image.js` |

A type whose file is not imported is unknown: after three seconds the card shows
an error for that extra. You can therefore remove the imports of types you never
use. The order in which the files are loaded does not matter; a card created before an
extras file has loaded rebuilds itself as soon as the file is available.

To add a type, create a file that registers the type in `window.CustomRowsExtras`
with a `parse` function (validates the configuration of the extra), a `build`
function (builds the row and returns `{ el, update, dispose }`) and optionally a
badge, and add an import for it to `ha-custom-cards.js`. `camera.js` is the shortest
example.

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
| `power_switch` with `badge` | The switch is on, or with `use_status: true` and a `status` sensor: the `status` sensor is on | Configured icon and colour |
| `media_player` with `badge` | The player is playing | Configured icon and colour |

The `badge` option of a `power_switch` or `media_player` extra is optional; without
it no badge is shown. It has the following options:

| Option | Default | Description |
| :--- | :--- | :--- |
| `icon` | `mdi:flash` (`power_switch`), `mdi:play` (`media_player`) | Icon of the badge, e.g. `mdi:music-note` |
| `color` | `var(--primary-color)` | Colour of the circle: any CSS colour (`orange`, `#2196f3`) or Home Assistant variable. The icon itself is always white |
| `use_status` | `false` | Only for `power_switch`: show the badge while the `status` binary sensor is on instead of while the switch is on. Without a configured `status` sensor this option is ignored and the badge follows the switch |
