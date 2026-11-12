# Home Assistant Custom Cards

A collection of compact custom cards for Home Assistant. The cards
display information about your network infrastructure, Synology NAS,
desktop computer and Docker containers.

All cards share a common base library and stylesheet, providing a
consistent appearance and centralised handling of commonly used
functionality.

## Contents

| Card | Description | Configuration |
| :--- | :--- | :--- |
| **Custom Network Infrastructure Card** | Router status, networks, connected users and network devices | [Documentation](Documentation/custom-network-infrastructure-card.md) |
| **Synology NAS Card** | NAS status, system usage, network traffic, volumes and disks | [Documentation](Documentation/synology-nas-card.md) |
| **Custom Desktop Card** | Desktop computer status and performance | [Documentation](Documentation/custom-desktop-card.md) |
| **Custom Rows Card** | Responsive rows with sensors, switches and expandable controls (media player, climate, power switch, cover, light, sensors, consumption) | [Documentation](Documentation/custom-rows-card.md) |
| **Docker Combined Card** | Overview of Docker containers, grouped by project | [Documentation](Documentation/docker-combined-card.md) |

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
├── Documentation/
│   ├── custom-network-infrastructure-card.md
│   ├── synology-nas-card.md
│   ├── custom-desktop-card.md
│   ├── custom-rows-card.md
│   └── docker-combined-card.md
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
-   **Documentation/** -- one configuration guide per card.

The cards are separate components but rely on the shared files. Only
load the central `ha-custom-cards.js` file, not the individual card
files.

------------------------------------------------------------------------

# Card configuration

The configuration options, examples and behaviour of each card are described
in a separate guide in the [Documentation](Documentation/) folder:

-   [Custom Network Infrastructure Card](Documentation/custom-network-infrastructure-card.md)
-   [Synology NAS Card](Documentation/synology-nas-card.md)
-   [Custom Desktop Card](Documentation/custom-desktop-card.md)
-   [Custom Rows Card](Documentation/custom-rows-card.md)
-   [Docker Combined Card](Documentation/docker-combined-card.md)

All examples use the YAML configuration format for Home Assistant dashboards.

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
