# Dockhand Card

[Back to the overview](../README.md)

All examples use the YAML configuration format for Home Assistant dashboards.

Displays the stacks and containers of the
[Dockhand](https://github.com/raetha/ha-dockhand) integration for Home
Assistant, including CPU, memory and network usage. The look and behaviour
are the same as the [Docker Combined Card](docker-combined-card.md); the
difference is where the data comes from: every Dockhand **stack** is a
project, and nothing has to be configured per container.

## Requirements

-   The Dockhand integration is installed and connected to your Dockhand
    server.
-   For CPU, memory and network values, container statistics are enabled in
    the integration and the statistics sensors are enabled in Home Assistant
    (disabled by default). Without them the card shows `—` instead of a
    value.

## Configuration options

| Option | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `environment` | No | All | Only show the stacks and containers of this Dockhand environment (the name as shown in Dockhand) |
| `css_url` | No | Automatic | Alternative path to the shared stylesheet |

Both options can be set in the visual editor.

## Example

``` yaml
type: custom:dockhand-card
```

``` yaml
type: custom:dockhand-card
environment: Synology DS1522+
```

## How stacks and containers are found

The card discovers everything itself, using the devices of the Dockhand
integration:

-   A device whose model contains *Stack* is a project. A device whose model
    contains *Container* is a container.
-   The containers of a stack are taken from the `container_names` attribute
    of the stack's **Containers** sensor and matched by name with the
    container devices of the same environment.
-   Containers that do not belong to any stack are grouped in a virtual
    project **Other**, which is hidden when it has no containers.
-   Projects are sorted alphabetically with **Other** last; containers are
    sorted alphabetically within a project.

The entity IDs of the integration follow the language of Home Assistant
(for example `_cpu_gebruik` in Dutch). The card therefore recognises each
entity by its translation key first, then by its entity ID (English and
Dutch names), and the status sensors by their state values (`running`,
`exited`, `partial`, ...).

### Used entities

| Level | Function | Entity |
| :--- | :--- | :--- |
| Stack | Status | *Status* sensor (`running`, `partial`, `stopped`, `created`, `restarting`) |
| Stack | Number of containers and their names | *Containers* sensor (state and `container_names` attribute) |
| Stack | CPU, memory, network in and out | CPU, memory usage and network sensors of the stack, with the number of running containers in the `running_containers` attribute |
| Container | Status | *State* sensor, otherwise the switch |
| Container | CPU, memory, network in and out | CPU, memory usage and network sensors of the container |
| Container | Start/stop | The container switch |

The memory limit and percentage sensors are not used. Memory is shown in MB;
network traffic is the total since the container started, shown with an
automatic unit (`B`, `KB`, `MB`, `GB`, `TB`), not as a speed.

## What the card shows

The header shows:

-   A subtitle such as *12 containers in 4 projects*. The number of projects
    includes **Other** when it has containers.
-   A second line with the total CPU and RAM usage of all running containers,
    in the same format as the Custom Desktop Card (`CPU 1.2 % · RAM 1234 MB`).
-   A status badge: *All running*, *x/y running*, *All stopped* or *No
    containers found*.

Click the header to show or hide the projects. Each project shows its name
and a status badge on the first line, and its CPU, RAM, Rx and Tx on the
second line. Click a project to show or hide its containers. Each container
row shows an icon, the name, CPU, RAM, the status (running, stopped or
unknown) and an on/off toggle.

### Project status

The number of running containers of a stack comes from the
`running_containers` attribute of its sensors. The *Status* sensor of
Dockhand alone is not enough: it reports `running` as soon as one container
runs. The card therefore shows *x/y running* when only some containers run.
If the attribute is not available, the card counts the containers it can
read, and as a last resort uses the status of the stack.

| Situation | Badge |
| :--- | :--- |
| All containers running | *All running* (green) |
| Some containers running | *x/y running* (orange) |
| No container running | *All stopped* (grey) |
| Stack is restarting | *Restarting* (orange) |
| Stack is created but not started | *Created* (grey) |
| Partly running, count unknown | *Partially active* (orange) |

The CPU, RAM, Rx and Tx of a project are the values of the stack's own
sensors; if these are not available, the overview shows `—` for running
containers and zero for stopped ones.

## Starting and stopping containers

Containers can be started and stopped with the toggle on the right of the
row. The question is asked in the row itself, without a pop-up: the row is
replaced by *Stop x?* or *Start x?* with a cross (cancel) and a check
(confirm). Without a reaction the row returns after five seconds, and the
question also disappears when the container is switched by something else in
the meantime.

A container that is listed by its stack but has no device of its own is
still shown, with an unknown status and without a toggle.
