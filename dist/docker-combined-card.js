// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    class DockerCombinedCard extends CardBase {
      setConfig(config) {
        const projects = (config.projects || []).map((project, index) => {
          const name = project.name || project.project;

          if (!name) {
            throw new Error(`Project ${index + 1}: geef een naam op via name.`);
          }

          if (!Array.isArray(project.containers) || !project.containers.length) {
            throw new Error(
              `Project "${name}": geef minimaal één container op via containers.`
            );
          }

          return { name, containers: project.containers };
        });

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          entity_prefix: config.entity_prefix || "unraid_docker_",
          projects
        };

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
        header.setAttribute("aria-expanded", "false");
        header.setAttribute("aria-label", "Toon Docker projecten");

        const icon = document.createElement("ha-icon");
        icon.className = "card-icon";
        icon.icon = "mdi:docker";

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = "Docker";

        const subtitle = document.createElement("div");
        subtitle.className = "card-summary";

        info.append(title, subtitle);

        const status = document.createElement("div");
        status.className = "status-badge";

        header.append(icon, info, status);

        // Divider
        const divider = document.createElement("div");
        divider.className = "divider";

        // Metrics
        const metrics = document.createElement("div");
        metrics.className = "metrics";

        const createMetric = labelText => {
          const metric = document.createElement("div");
          metric.className = "metric";

          const label = document.createElement("div");
          label.className = "metric-label";
          label.textContent = labelText;

          const value = document.createElement("div");
          value.className = "metric-value";

          metric.append(label, value);

          return { metric, value };
        };

        const containersMetric = createMetric("Containers actief");
        const cpuMetric = createMetric("CPU-gebruik");
        const memoryMetric = createMetric("Geheugengebruik");

        metrics.append(
          containersMetric.metric,
          cpuMetric.metric,
          memoryMetric.metric
        );

        // Projectenlijst
        const projectList = document.createElement("div");
        projectList.className = "projects";
        projectList.hidden = true;

        // Projecten uit de configuratie + virtueel project "Other"
        this._projects = this._config.projects.map(project =>
          this._createProject(project.name, project.containers)
        );

        this._otherProject = this._createProject("Other", []);
        this._otherProject.el.hidden = true;
        this._otherKey = null;

        projectList.append(
          ...this._projects.map(project => project.el),
          this._otherProject.el
        );

        // Header toggle
        const toggleProjects = () => {
          this._expanded = !this._expanded;
          projectList.hidden = !this._expanded;

          header.setAttribute("aria-expanded", String(this._expanded));
          header.setAttribute(
            "aria-label",
            this._expanded ? "Verberg Docker projecten" : "Toon Docker projecten"
          );
        };

        this._onActivate(header, toggleProjects);

        card.append(header, divider, metrics, projectList);

        this._setContent(card);

        this._subtitle = subtitle;
        this._status = status;
        this._containersValue = containersMetric.value;
        this._cpuValue = cpuMetric.value;
        this._memoryValue = memoryMetric.value;
        this._projectList = projectList;

        this._update();
      }

      // Bouwt één projectvak (kop + uitklapbare containerlijst)
      _createProject(name, containerNames) {
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
          `${expanded ? "Verberg" : "Toon"} containers van ${name}`
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
            `${next ? "Verberg" : "Toon"} containers van ${name}`
          );
        };

        this._onActivate(header, toggleContainers);

        el.append(header, grid);

        const project = { name, el, summary, status, grid, rows: [] };

        this._createRows(project, containerNames);

        return project;
      }

      // Bouwt de containerrijen van een project (als losse cellen in het grid)
      _createRows(project, names) {
        const prefix = this._config.entity_prefix;

        project.grid.replaceChildren();

        project.rows = names.map(name => {
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

          // Container aan/uit-knop
          const toggleButton = document.createElement("button");
          toggleButton.className = "container-toggle";
          toggleButton.type = "button";
          toggleButton.setAttribute("aria-label", `Schakel ${name} container`);

          const toggleIcon = document.createElement("ha-icon");
          toggleButton.append(toggleIcon);

          toggleButton.addEventListener("click", event => {
            event.stopPropagation();

            const turnOff =
              this._hass?.states[`switch.${prefix}${name}`]?.state === "on";
            const verb = turnOff ? "uitschakelen" : "inschakelen";

            this._runAction(
              {
                action: "perform-action",
                perform_action: turnOff ? "switch.turn_off" : "switch.turn_on",
                data: { entity_id: `switch.${prefix}${name}` },
                confirmation: {
                  text: `Weet je zeker dat je de container "${name}" wilt ${verb}?`
                }
              },
              name
            );
          });

          project.grid.append(icon, nameEl, cpu, memory, state, toggleButton);

          return {
            name,
            switchId: `switch.${prefix}${name}`,
            cpuId: `sensor.${prefix}${name}_cpu`,
            memoryId: `sensor.${prefix}${name}_memory_usage`,
            rxId: `sensor.${prefix}${name}_network_rx`,
            txId: `sensor.${prefix}${name}_network_tx`,
            icon,
            cpu,
            memory,
            state,
            toggleButton,
            toggleIcon
          };
        });
      }

      // Alle containers automatisch ontdekken via de switch-prefix
      _getContainers() {
        if (!this._hass) return [];

        const switchPrefix = `switch.${this._config.entity_prefix}`;

        return Object.keys(this._hass.states)
          .filter(entityId => entityId.startsWith(switchPrefix))
          .map(entityId => entityId.substring(switchPrefix.length))
          .sort((a, b) => a.localeCompare(b));
      }

      // Numerieke waarde; 0 bij onbekend/niet beschikbaar (voor totalen)
      _getNumberOrZero(entityId) {
        const state = this._hass?.states[entityId];

        if (
          !state ||
          state.state === "unknown" ||
          state.state === "unavailable"
        ) {
          return 0;
        }

        const value = Number(state.state);

        return Number.isFinite(value) ? value : 0;
      }

      _format(value, decimals = 1) {
        if (value === null) return "—";
        return value.toFixed(decimals);
      }

      _update() {
        if (!this._hass || !this._projects) return;

        const discovered = this._getContainers();

        // Containers die in geen enkel project zitten -> virtueel project "Other"
        const configured = new Set(
          this._config.projects.flatMap(project => project.containers)
        );
        const otherNames = discovered.filter(name => !configured.has(name));
        const otherKey = otherNames.join("|");

        if (otherKey !== this._otherKey) {
          this._otherKey = otherKey;
          this._createRows(this._otherProject, otherNames);
          this._otherProject.el.hidden = otherNames.length === 0;
        }

        // ----- Totaaloverzicht over alle containers -----
        let running = 0;
        let totalCpu = 0;
        let totalMemory = 0;

        const total = discovered.length;
        const prefix = this._config.entity_prefix;

        for (const name of discovered) {
          const isRunning =
            this._hass.states[`switch.${prefix}${name}`]?.state === "on";

          // Alleen draaiende containers tellen mee voor het resourcegebruik
          if (isRunning) {
            running++;

            totalCpu += this._getNumberOrZero(`sensor.${prefix}${name}_cpu`);
            totalMemory += this._getNumberOrZero(
              `sensor.${prefix}${name}_memory_usage`
            );
          }
        }

        this._containersValue.textContent = `${running} / ${total}`;
        this._subtitle.textContent = `${total} containers in totaal`;
        this._cpuValue.textContent = `${totalCpu.toFixed(1)}%`;
        this._memoryValue.textContent = `${totalMemory.toFixed(0)} MB`;

        this._status.textContent =
          total === 0 ? "Geen containers gevonden" :
          running === total ? "Alles actief" :
          running === 0 ? "Alles gestopt" :
          `${running}/${total} actief`;

        this._setBadge(
          this._status,
          total === 0 ? "warning" :
          running === total ? "success" :
          running === 0 ? "muted" :
          "warning"
        );

        // ----- Projecten -----
        for (const project of [...this._projects, this._otherProject]) {
          this._updateProject(project);
        }
      }

      _updateProject(project) {
        if (!project.rows.length) return;

        let running = 0;
        let totalCpu = 0;
        let totalMemory = 0;
        let totalRx = 0;
        let totalTx = 0;
        let rxCount = 0;
        let txCount = 0;
        let rxUnit = "";
        let txUnit = "";

        for (const row of project.rows) {
          const switchState = this._hass.states[row.switchId]?.state;
          const isRunning = switchState === "on";

          if (isRunning) running++;

          // Gestopte of onbeschikbare containers hebben altijd 0 gebruik
          const cpu = isRunning ? (this._getNumber(row.cpuId) ?? 0) : 0;
          const memory = isRunning ? (this._getNumber(row.memoryId) ?? 0) : 0;
          const rx = isRunning ? (this._getNumber(row.rxId) ?? 0) : 0;
          const tx = isRunning ? (this._getNumber(row.txId) ?? 0) : 0;

          totalCpu += cpu;
          totalMemory += memory;

          if (isRunning) {
            totalRx += rx;
            totalTx += tx;

            rxCount++;
            txCount++;

            rxUnit = this._getUnit(row.rxId) || rxUnit;
            txUnit = this._getUnit(row.txId) || txUnit;
          }

          // Container icoon
          row.icon.classList.toggle("running", isRunning);
          row.icon.icon = isRunning ? "mdi:cube" : "mdi:cube-outline";

          // Container status
          row.state.classList.toggle("running", isRunning);
          row.state.textContent =
            switchState === "on" ? "Actief" :
            switchState === "off" ? "Gestopt" :
            "Onbekend";

          // CPU en RAM
          row.cpu.textContent = `${this._format(cpu)}%`;
          row.memory.textContent = `${this._format(memory, 0)} MB`;

          // Aan/uit-knop
          row.toggleIcon.icon = isRunning
            ? "mdi:toggle-switch-variant"
            : "mdi:toggle-switch-variant-off";

          row.toggleButton.classList.toggle("running", isRunning);
          row.toggleButton.setAttribute(
            "aria-label",
            isRunning
              ? `Schakel ${row.name} container uit`
              : `Schakel ${row.name} container in`
          );
        }

        const total = project.rows.length;

        const rxText = rxCount ? `${totalRx.toFixed(1)} ${rxUnit}` : `0 ${rxUnit}`;
        const txText = txCount ? `${totalTx.toFixed(1)} ${txUnit}` : `0 ${txUnit}`;

        // Niet-brekende spaties binnen een onderdeel: afbreken kan alleen tussen onderdelen
        const nb = text => text.trim().replace(/ /g, "\u00a0");

        project.summary.textContent = [
          nb(`CPU ${totalCpu.toFixed(1)}%`),
          nb(`RAM ${totalMemory.toFixed(0)} MB`),
          nb(`Rx: ${rxText}`),
          nb(`Tx: ${txText}`)
        ].join("  ·  ");

        project.status.textContent =
          running === total ? "Alles actief" :
          running === 0 ? "Alles gestopt" :
          `${running}/${total} actief`;

        this._setBadge(
          project.status,
          running === total ? "success" :
          running === 0 ? "muted" :
          "warning"
        );
      }

      getCardSize() {
        if (!this._expanded || !this._projects) return 2;

        let size = 3;

        for (const project of [...this._projects, this._otherProject]) {
          if (project.el.hidden) continue;

          size += 2;

          if (this._expandedProjects[project.name]) {
            size += project.rows.length;
          }
        }

        return size;
      }
    }

    registerCard("docker-combined-card", DockerCombinedCard, {
      name: "Docker Combined",
      description: "Docker overzicht met uitklapbare projecten en containers"
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("docker-combined-card: custom-cards-shared.js is niet geladen. Voeg dat bestand toe als resource.");
      }
    }, 5000);
  }
})();
