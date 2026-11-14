// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
// Gebruikt de entiteiten van de Dockhand-integratie (ha-dockhand):
//   - elke stack is een project, met zijn containers
//   - containers die in geen enkele stack zitten komen in het virtuele project "Other"
// Stacks en containers worden automatisch ontdekt via de apparaten van de integratie.
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    // Datagroottes (de integratie levert o.a. geheugen en netwerk in bytes, getoond in MiB)
    const DATA_UNITS = {
      B: 1,
      KB: 1024, KIB: 1024,
      MB: 1024 ** 2, MIB: 1024 ** 2,
      GB: 1024 ** 3, GIB: 1024 ** 3,
      TB: 1024 ** 4, TIB: 1024 ** 4
    };
    const MIB = 1024 ** 2;

    // Statuswaarden van Docker en Dockhand (blijven Engels, ook als HA in het Nederlands staat)
    const CONTAINER_STATES = ["running", "exited", "paused", "created", "restarting", "dead", "removing"];
    const STACK_STATES = ["running", "partial", "stopped", "created", "restarting"];

    // Apparaatnamen zijn "{omgeving} – Stacks – {naam}" of "{omgeving} – Containers – {naam}"
    const parseDeviceName = (value) => {
      const parts = String(value || "").split(/\s+[–—-]\s+/).map((part) => part.trim()).filter(Boolean);
      return { env: parts.length > 1 ? parts[0] : null, name: parts[parts.length - 1] || "" };
    };

    const byName = (a, b) => a.name.localeCompare(b.name);

    class DockhandCard extends CardBase {
      setConfig(config) {
        this._configError = null;
        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          environment: config.environment // optioneel: alleen deze Dockhand-omgeving tonen
        };

        this._discovery = null;
        this._structureKey = null;

        // Opgeklapt/uitgeklapt per niveau
        this._expanded = false;
        this._expandedProjects = {};

        this._build();
      }

      _build() {
        if (!this._ensureShadow()) return;

        const card = document.createElement("ha-card");

        // Header (overzicht)
        const header = document.createElement("div");
        header.className = "header";
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", String(this._expanded));
        header.setAttribute(
          "aria-label",
          this._t(this._expanded ? "docker.hide_projects" : "docker.show_projects")
        );

        const icon = document.createElement("ha-icon");
        icon.className = "card-icon";
        icon.icon = "mdi:docker";

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = this._t("dockhand.title");

        const subtitle = document.createElement("div");
        subtitle.className = "card-summary";

        // Regel 1: "x containers in y projecten", regel 2: CPU en RAM (totaal)
        const subtitleRow1 = document.createElement("div");
        subtitleRow1.className = "summary-row";

        // Zelfde opbouw als de CPU/RAM-regel van custom-desktop-card:
        // losse onderdelen met een "·" als scheidingsteken
        const subtitleRow2 = document.createElement("div");
        subtitleRow2.className = "summary-row";

        const cpuItem = document.createElement("span");
        const usageSeparator = document.createElement("span");
        usageSeparator.textContent = "·";
        const memoryItem = document.createElement("span");

        subtitleRow2.append(cpuItem, usageSeparator, memoryItem);

        subtitle.append(subtitleRow1, subtitleRow2);

        info.append(title, subtitle);

        const status = document.createElement("div");
        status.className = "status-badge";

        header.append(icon, info, status);

        // Projectenlijst (wordt gevuld zodra de stacks ontdekt zijn)
        const projectList = document.createElement("div");
        projectList.className = "projects";
        projectList.hidden = !this._expanded;

        this._projects = [];

        // Header toggle
        const toggleProjects = () => {
          this._expanded = !this._expanded;
          projectList.hidden = !this._expanded;

          header.setAttribute("aria-expanded", String(this._expanded));
          header.setAttribute(
            "aria-label",
            this._t(this._expanded ? "docker.hide_projects" : "docker.show_projects")
          );
        };

        this._onActivate(header, toggleProjects);

        card.append(header, projectList);

        this._setContent(card);

        this._subtitle = subtitleRow1;
        this._cpuItem = cpuItem;
        this._memoryItem = memoryItem;
        this._status = status;
        this._projectList = projectList;
        this._structureKey = null;

        this._update();
      }

      // ----- Ontdekken van stacks en containers -----

      // Zoekt de apparaten van de Dockhand-integratie en koppelt hun entiteiten.
      // Gecachet: alleen opnieuw bij wijzigingen in de apparaat- of entiteitenregister.
      _discover() {
        const hass = this._hass;
        if (!hass?.entities || !hass?.devices) return { stacks: [], containers: [] };

        if (
          this._discovery &&
          this._discoveryEntities === hass.entities &&
          this._discoveryDevices === hass.devices
        ) {
          return this._discovery;
        }

        const entriesByDevice = new Map();

        for (const entry of Object.values(hass.entities)) {
          if (!entry.device_id) continue;
          if (entry.platform && entry.platform !== "dockhand") continue;

          if (!entriesByDevice.has(entry.device_id)) entriesByDevice.set(entry.device_id, []);
          entriesByDevice.get(entry.device_id).push({
            id: entry.entity_id,
            key: entry.translation_key || ""
          });
        }

        const environment = this._config.environment?.toLowerCase();
        const stacks = [];
        const containers = [];

        for (const [deviceId, entries] of entriesByDevice) {
          const device = hass.devices[deviceId];
          if (!device) continue;

          const model = device.model || "";
          const kind = /stack/i.test(model) ? "stack" : /container/i.test(model) ? "container" : null;
          if (!kind) continue;

          const parsed = parseDeviceName(device.name);
          if (!parsed.name) continue;
          if (environment && parsed.env && parsed.env.toLowerCase() !== environment) continue;

          const item = {
            env: parsed.env,
            name: parsed.name,
            displayName: device.name_by_user ? parseDeviceName(device.name_by_user).name : parsed.name,
            entries
          };

          (kind === "stack" ? stacks : containers).push(item);
        }

        const containerMap = new Map(containers.map((c) => [`${c.env || ""}|${c.name}`, c]));
        const containerByName = new Map();
        for (const container of containers) {
          if (!containerByName.has(container.name)) containerByName.set(container.name, container);
        }

        this._discovery = {
          stacks: stacks.sort(byName),
          containers,
          containerMap,
          containerByName
        };
        this._discoveryEntities = hass.entities;
        this._discoveryDevices = hass.devices;

        return this._discovery;
      }

      // Koppelt de entiteiten van een stack of container aan hun rol.
      // De entiteit-id's volgen de taal van Home Assistant (bijv. "_cpu_gebruik"), daarom
      // wordt eerst op translation_key gezocht, dan op Engelse en Nederlandse id's en
      // tot slot op de status zelf (running, exited, ...).
      _roles(item) {
        const states = this._hass?.states;
        if (item._rolesFor === states && item._roles) return item._roles;

        const sensors = item.entries.filter((e) => e.id.startsWith("sensor."));
        const test = (e, re) => re.test(e.key) || re.test(e.id);
        const shortest = (list) => list.map((e) => e.id).sort((a, b) => a.length - b.length)[0] || null;
        const pick = (re, exclude) =>
          shortest(sensors.filter((e) => test(e, re) && !(exclude && test(e, exclude))));
        const stateOf = (id) => states?.[id];

        const resource = /cpu|memory|geheugen|network|netwerk|disk|schijf/i;

        // Eerste sensor zonder eenheid waarvan de status aan de test voldoet
        const byState = (test) =>
          shortest(sensors.filter((e) => {
            const state = stateOf(e.id);
            return state && !state.attributes?.unit_of_measurement && !resource.test(e.id) && test(state);
          }));

        const roles = {
          switchId: shortest(item.entries.filter(
            (e) => e.id.startsWith("switch.") && !/auto_?(update|deploy)|automatisch/i.test(e.id + e.key)
          )),
          cpuId: pick(/cpu/i, /limit|limiet/i),
          // Meerdere geheugensensoren (gebruik, limiet, %): de juiste wordt op eenheid gekozen
          memoryIds: sensors
            .filter((e) => test(e, /memory_usage|geheugengebruik/i) && !test(e, /percent|pct|limit|limiet/i))
            .map((e) => e.id),
          rxId: pick(/(network_in|netwerk_in)$/i),
          txId: pick(/(network_out|netwerk_uit)$/i),
          stateId:
            pick(/^state$|_(state|staat)$/i) ||
            byState((state) => CONTAINER_STATES.includes(state.state)),
          statusId:
            pick(/^status$|_status$/i, /sync/i) ||
            byState((state) => STACK_STATES.includes(state.state)),
          countId:
            pick(/^containers$|_containers$/i) ||
            byState((state) => state.state !== "" && Number.isFinite(Number(state.state)))
        };

        item._rolesFor = states;
        item._roles = roles;

        return roles;
      }

      // Namen van de containers in een stack (attribuut van de Containers- of Status-sensor)
      _memberNames(stack) {
        const roles = this._roles(stack);
        let raw;

        for (const id of [roles.countId, roles.statusId]) {
          const attributes = this._getState(id)?.attributes || {};
          raw = attributes.container_names ?? attributes.containers ?? attributes.names;
          if (raw) break;
        }

        let list = [];
        if (Array.isArray(raw)) {
          list = raw.map((item) => (typeof item === "string" ? item : item?.name));
        } else if (typeof raw === "string") {
          list = raw.split(/[,;]\s*/);
        }

        return [...new Set(list.filter(Boolean).map((name) => String(name).replace(/^\//, "").trim()))];
      }

      // Projecten (stacks) met hun containers, plus het virtuele project "Other"
      _model() {
        const discovery = this._discover();
        const claimed = new Set();

        const projects = discovery.stacks.map((stack) => {
          const members = this._memberNames(stack)
            .map((name) => {
              const container =
                discovery.containerMap?.get(`${stack.env || ""}|${name}`) ||
                discovery.containerByName?.get(name) ||
                null;

              if (container) claimed.add(container);

              return { name, container };
            })
            .sort(byName);

          return { name: stack.displayName, stack, members };
        });

        const others = discovery.containers
          .filter((container) => !claimed.has(container))
          .map((container) => ({ name: container.name, container }))
          .sort(byName);

        if (others.length) {
          projects.push({ name: this._t("docker.other"), stack: null, members: others });
        }

        const key = projects
          .map((project) => `${project.name}:${project.members.map((m) => m.name).join(",")}`)
          .join("|");

        return { projects, key };
      }

      _observedEntityIds() {
        const ids = super._observedEntityIds();
        const { stacks, containers } = this._discover();

        // Alle entiteiten van de apparaten: de rollen hangen mede af van hun status
        for (const item of [...stacks, ...containers]) {
          for (const entry of item.entries) ids.add(entry.id);
        }

        return ids;
      }

      // ----- Opbouw van de projecten -----

      _rebuildProjects(model) {
        this._projects = model.projects.map((data) => this._createProject(data.name, data.members));
        this._projectList.replaceChildren(...this._projects.map((project) => project.el));
      }

      // Bouwt één projectvak (kop + uitklapbare containerlijst)
      _createProject(name, members) {
        const el = document.createElement("div");
        el.className = "project";

        const expanded = Boolean(this._expandedProjects[name]);

        const header = document.createElement("div");
        header.className = "project-header";
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", String(expanded));
        header.setAttribute(
          "aria-label",
          this._t(expanded ? "docker.hide_containers" : "docker.show_containers", { name })
        );

        // Bovenste regel: naam links, statusindicator rechts
        const top = document.createElement("div");
        top.className = "project-top";

        const projectName = document.createElement("div");
        projectName.className = "project-name";
        projectName.textContent = name;

        const status = document.createElement("div");
        status.className = "status-badge";

        top.append(projectName, status);

        // Tweede regel: CPU, RAM, Rx en Tx
        const summary = document.createElement("div");
        summary.className = "card-summary";

        header.append(top, summary);

        const grid = document.createElement("div");
        grid.className = "container-grid";
        grid.hidden = !expanded;

        const toggleContainers = () => {
          const next = !this._expandedProjects[name];

          this._expandedProjects[name] = next;
          grid.hidden = !next;

          header.setAttribute("aria-expanded", String(next));
          header.setAttribute(
            "aria-label",
            this._t(next ? "docker.hide_containers" : "docker.show_containers", { name })
          );
        };

        this._onActivate(header, toggleContainers);

        el.append(header, grid);

        const project = { name, el, summary, status, grid, rows: [] };

        this._createRows(project, members);

        return project;
      }

      // Bouwt de containerrijen van een project (als losse cellen in het grid)
      _createRows(project, members) {
        project.grid.replaceChildren();

        project.rows = members.map(({ name, container }) => {
          const icon = document.createElement("ha-icon");
          icon.className = "container-icon";
          icon.icon = "mdi:cube-outline";

          const nameEl = document.createElement("div");
          nameEl.className = "container-name";
          nameEl.textContent = name;
          nameEl.title = name;

          const cpu = document.createElement("span");
          cpu.className = "container-value col-end";

          const memory = document.createElement("span");
          memory.className = "container-value col-end";

          const state = document.createElement("div");
          state.className = "container-state";

          // Container aan/uit-knop (alleen als de container een schakelaar heeft)
          const toggleButton = document.createElement("button");
          toggleButton.className = "container-toggle";
          toggleButton.type = "button";
          toggleButton.setAttribute("aria-label", this._t("docker.toggle", { name }));
          toggleButton.style.visibility = container && this._roles(container).switchId ? "" : "hidden";

          const toggleIcon = document.createElement("ha-icon");
          toggleButton.append(toggleIcon);

          toggleButton.addEventListener("click", (event) => {
            event.stopPropagation();

            const switchId = container ? this._roles(container).switchId : null;
            if (!switchId) return;

            const turnOff = this._hass?.states[switchId]?.state === "on";

            this._runAction({
              action: "perform-action",
              perform_action: turnOff ? "switch.turn_off" : "switch.turn_on",
              data: { entity_id: switchId },
              confirmation: {
                text: this._t(turnOff ? "docker.confirm_off" : "docker.confirm_on", { name })
              }
            });
          });

          project.grid.append(icon, nameEl, cpu, memory, state, toggleButton);

          return { name, container, icon, cpu, memory, state, toggleButton, toggleIcon };
        });
      }

      // ----- Waarden -----

      // Waarde omgerekend naar bytes; null bij onbekend of een eenheid die geen datagrootte is
      _bytes(entityId) {
        const value = this._getNumber(entityId);
        if (value === null) return null;

        const factor = DATA_UNITS[String(this._getUnit(entityId, "B")).toUpperCase()];

        return factor ? value * factor : null;
      }

      // Geheugengebruik in MB: de sensor in bytes (niet de procentsensor)
      _memoryMb(roles) {
        for (const id of roles.memoryIds) {
          const bytes = this._bytes(id);
          if (bytes !== null && DATA_UNITS[String(this._getUnit(id)).toUpperCase()]) return bytes / MIB;
        }
        return null;
      }

      _formatBytes(bytes) {
        const units = ["B", "KB", "MB", "GB", "TB"];
        let value = bytes;
        let index = 0;

        while (value >= 1024 && index < units.length - 1) {
          value /= 1024;
          index++;
        }

        return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
      }

      _format(value, decimals = 1) {
        if (value === null) return "—";
        return value.toFixed(decimals);
      }

      // ----- Bijwerken -----

      _update() {
        if (!this._hass || !this._projects) return;

        const model = this._model();

        // Stacks of containers erbij of weg: projectenlijst opnieuw opbouwen
        if (model.key !== this._structureKey) {
          this._structureKey = model.key;
          this._rebuildProjects(model);
        }

        // ----- Projecten -----
        let running = 0;
        let total = 0;
        let totalCpu = 0;
        let totalMemory = 0;
        let cpuSeen = false;
        let memorySeen = false;

        model.projects.forEach((data, index) => {
          const result = this._updateProject(this._projects[index], data);

          running += result.running;
          total += result.total;
          totalCpu += result.cpu;
          totalMemory += result.memory;
          cpuSeen ||= result.cpuSeen;
          memorySeen ||= result.memorySeen;
        });

        // ----- Totaaloverzicht over alle containers -----
        this._subtitle.textContent = this._t("docker.subtitle", {
          containers: this._t("docker.container_count", { count: total }),
          projects: this._t("docker.project_count", { count: model.projects.length })
        });

        // Zelfde weergave als custom-desktop-card: "CPU 1.2 %" · "RAM 1234 MB"
        // Zonder statistiekensensoren (staan standaard uit) blijft het bij een streepje.
        const unseen = running > 0;
        this._cpuItem.textContent =
          `${this._t("label.cpu")} ${unseen && !cpuSeen ? "—" : this._formatNumber(totalCpu, 1)} %`;
        this._memoryItem.textContent =
          `${this._t("label.ram")} ${unseen && !memorySeen ? "—" : this._formatNumber(totalMemory, 0)} MB`;

        this._status.textContent =
          total === 0 ? this._t("docker.status.none") :
          running === total ? this._t("docker.status.all_active") :
          running === 0 ? this._t("docker.status.all_stopped") :
          this._t("docker.status.partial", { running, total });

        this._setBadge(
          this._status,
          total === 0 ? "warning" :
          running === total ? "success" :
          running === 0 ? "muted" :
          "warning"
        );
      }

      _updateProject(project, data) {
        const stack = data.stack;
        const stackRoles = stack ? this._roles(stack) : null;

        let resolved = 0;
        let runningRows = 0;
        let cpu = 0;
        let memory = 0;
        let rx = 0;
        let tx = 0;
        let cpuSeen = false;
        let memorySeen = false;
        let rxSeen = false;
        let txSeen = false;

        for (const row of project.rows) {
          const container = row.container;
          const roles = container ? this._roles(container) : null;

          // Status: de State-sensor, anders de schakelaar
          const stateValue = roles ? this._getValue(roles.stateId) : null;
          const switchState = roles ? this._hass.states[roles.switchId]?.state : undefined;

          let known = false;
          let isRunning = false;

          if (stateValue !== null) {
            known = true;
            isRunning = stateValue === "running";
          } else if (switchState === "on" || switchState === "off") {
            known = true;
            isRunning = switchState === "on";
          }

          if (known) resolved++;
          if (isRunning) runningRows++;

          // Gestopte of onbekende containers hebben geen gebruik; draaiende zonder sensor: streepje
          const cpuValue = isRunning ? this._getNumber(roles.cpuId) : null;
          const memoryValue = isRunning ? this._memoryMb(roles) : null;
          const rxValue = isRunning ? this._bytes(roles.rxId) : null;
          const txValue = isRunning ? this._bytes(roles.txId) : null;

          if (cpuValue !== null) { cpu += cpuValue; cpuSeen = true; }
          if (memoryValue !== null) { memory += memoryValue; memorySeen = true; }
          if (rxValue !== null) { rx += rxValue; rxSeen = true; }
          if (txValue !== null) { tx += txValue; txSeen = true; }

          // Container icoon
          row.icon.classList.toggle("running", isRunning);
          row.icon.icon = isRunning ? "mdi:cube" : "mdi:cube-outline";

          // Container status
          row.state.classList.toggle("running", isRunning);
          row.state.textContent =
            !known ? this._t("status.unknown") :
            isRunning ? this._t("status.active") :
            this._t("status.stopped");

          // CPU en RAM
          row.cpu.textContent = !known ? "—" : isRunning ? `${this._format(cpuValue)}%` : "0.0%";
          row.memory.textContent = !known ? "—" : isRunning ? `${this._format(memoryValue, 0)} MB` : "0 MB";

          // Aan/uit-knop
          row.toggleIcon.icon = isRunning
            ? "mdi:toggle-switch-variant"
            : "mdi:toggle-switch-variant-off";

          row.toggleButton.classList.toggle("running", isRunning);
          row.toggleButton.setAttribute(
            "aria-label",
            isRunning
              ? this._t("docker.toggle_off", { name: row.name })
              : this._t("docker.toggle_on", { name: row.name })
          );
        }

        // Een stack heeft zelf ook CPU-, geheugen- en netwerksensoren, met het aantal
        // draaiende containers als attribuut. Die zijn leidend voor de projectregel.
        let stackRunning = null;

        if (stackRoles) {
          const stackCpu = this._getNumber(stackRoles.cpuId);
          const stackMemory = this._memoryMb(stackRoles);
          const stackRx = this._bytes(stackRoles.rxId);
          const stackTx = this._bytes(stackRoles.txId);

          if (stackCpu !== null) { cpu = stackCpu; cpuSeen = true; }
          if (stackMemory !== null) { memory = stackMemory; memorySeen = true; }
          if (stackRx !== null) { rx = stackRx; rxSeen = true; }
          if (stackTx !== null) { tx = stackTx; txSeen = true; }

          for (const id of [stackRoles.cpuId, ...stackRoles.memoryIds, stackRoles.rxId, stackRoles.txId]) {
            const value = Number(this._getState(id)?.attributes?.running_containers);
            if (id && Number.isFinite(value) && this._getState(id)?.attributes?.running_containers !== undefined) {
              stackRunning = value;
              break;
            }
          }
        }

        // Aantal containers: de ontdekte leden, of het aantal volgens de stack zelf
        const stackCount = stackRoles ? this._getNumber(stackRoles.countId) : null;
        const total = Math.max(project.rows.length, stackCount ?? 0);

        // Stackstatus van Dockhand: "running" betekent niet dat alle containers draaien
        const stackStatus = stackRoles ? this._getValue(stackRoles.statusId) : null;

        // Aantal draaiende containers, in volgorde van betrouwbaarheid:
        // 1. het attribuut van de stacksensoren, 2. de eigen containers (als alle bekend zijn),
        // 3. de stackstatus
        let running = null;

        if (stackRunning !== null) running = Math.min(stackRunning, total);
        else if (project.rows.length && resolved === project.rows.length && project.rows.length === total) running = runningRows;
        else if (!stack) running = runningRows;
        else if (stackStatus === "running") running = total;
        else if (stackStatus === "stopped") running = 0;
        else if (resolved > 0) running = runningRows;

        // Niet-brekende spaties binnen een onderdeel: afbreken kan alleen tussen onderdelen
        const nb = text => text.trim().replace(/ /g, "\u00a0");

        // Een streepje als een draaiend project geen waarden levert (statistieken staan uit)
        const idle = running === 0 || (running === null && stackStatus === "stopped");
        const cpuText = cpuSeen || idle ? `${cpu.toFixed(1)}%` : "—";
        const memoryText = memorySeen || idle ? `${memory.toFixed(0)} MB` : "—";
        const rxText = rxSeen || idle ? this._formatBytes(rx) : "—";
        const txText = txSeen || idle ? this._formatBytes(tx) : "—";

        project.summary.textContent = [
          nb(`${this._t("label.cpu")} ${cpuText}`),
          nb(`${this._t("label.ram")} ${memoryText}`),
          nb(`${this._t("label.rx")}: ${rxText}`),
          nb(`${this._t("label.tx")}: ${txText}`)
        ].join("  ·  ");

        let label;
        let type;

        if (stackStatus === "restarting") {
          label = this._t("dockhand.status.restarting");
          type = "warning";
        } else if (stackStatus === "created") {
          label = this._t("dockhand.status.created");
          type = "muted";
        } else if (running === null) {
          // Geen aantallen bekend: val terug op de stackstatus
          label =
            stackStatus === "partial" ? this._t("dockhand.status.partial_unknown") : this._t("status.unknown");
          type = stackStatus === "partial" ? "warning" : "muted";
        } else if (total === 0) {
          label = this._t("status.unknown");
          type = "muted";
        } else if (running === total) {
          label = this._t("docker.status.all_active");
          type = "success";
        } else if (running === 0) {
          label = this._t("docker.status.all_stopped");
          type = "muted";
        } else {
          label = this._t("docker.status.partial", { running, total });
          type = "warning";
        }

        project.status.textContent = label;
        this._setBadge(project.status, type);

        return { running: running ?? 0, total, cpu, memory, cpuSeen, memorySeen };
      }

      getCardSize() {
        if (!this._expanded || !this._projects) return 2;

        let size = 3;

        for (const project of this._projects) {
          size += 2;

          if (this._expandedProjects[project.name]) {
            size += project.rows.length;
          }
        }

        return size;
      }
    }

    registerCard("dockhand-card", DockhandCard, {
      id: "dockhand",
      name: "Dockhand",
      description: "Dockhand stacks and containers.",
      editor: {
        schema: [
          { name: "environment", selector: { text: {} } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: {}
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("dockhand-card: custom-cards-shared.js is not loaded. Add that file as a resource.");
      }
    }, 5000);
  }
})();
