// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    class SynologyNasCard extends CardBase {
      setConfig(config) {
        this._configError = null;
        if (!config.name) {
          return this._invalidConfig("error.nas_name");
        }

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          name: config.name,
          temperature: config.temperature,
          security: config.security,
          cpu: config.cpu,
          memory: config.memory,
          network_rx: config.network_rx,
          network_tx: config.network_tx,
          volumes: config.volumes || []
        };

        // Houdt per volume-index bij of de schijven zichtbaar zijn
        this._expandedVolumes = {}; 
        this._volumeElements = []; // Slaat referenties op naar DOM-elementen om re-renders te voorkomen
        this._build();
      }

      _build() {
        if (!this._ensureShadow()) return;

        const card = document.createElement("ha-card");

        // Header
        const header = document.createElement("div");
        header.className = "header";

        const icon = document.createElement("ha-icon");
        icon.className = "card-icon";
        icon.icon = "mdi:nas";

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = this._config.name;

        const summary = document.createElement("div");
        summary.className = "card-summary";

        const summaryRow1 = document.createElement("div");
        summaryRow1.className = "summary-row";

        // CPU, RAM en temperatuur op de eerste regel: elk apart klikbaar
        this._summaryItems = [];
        [
          { key: "cpu", label: this._t("label.cpu"), decimals: 1, unit: "%" },
          { key: "memory", label: this._t("label.ram"), decimals: 0, unit: "%" },
          { key: "temperature", label: this._t("label.temp"), decimals: 1, unit: "°C" }
        ].forEach((def, index) => {
          if (index > 0) {
            const separator = document.createElement("span");
            separator.textContent = "·";
            summaryRow1.append(separator);
          }

          const el = document.createElement("span");
          this._makeClickable(el, this._config[def.key]);
          summaryRow1.append(el);
          this._summaryItems.push({ el, ...def });
        });

        summary.append(summaryRow1);

        // Network traffic
        const networkRow = document.createElement("div");
        networkRow.className = "network-row";

        const createNetworkItem = (iconName) => {
          const item = document.createElement("span");
          item.className = "network-item";

          const networkIcon = document.createElement("ha-icon");
          networkIcon.className = "network-icon";
          networkIcon.icon = iconName;

          const value = document.createElement("span");

          item.append(networkIcon, value);

          return { item, value };
        };

        const rxItem = createNetworkItem("mdi:download");
        const txItem = createNetworkItem("mdi:upload");

        this._makeClickable(rxItem.item, this._config.network_rx);
        this._makeClickable(txItem.item, this._config.network_tx);

        networkRow.append(rxItem.item, txItem.item);

        info.append(title, summary, networkRow);

        const status = document.createElement("div");
        status.className = "status-badge";

        // Beveiliging onder de statusindicator, buiten het gekleurde vlak
        const securityEl = document.createElement("div");
        securityEl.className = "security-status";

        const headerRight = document.createElement("div");
        headerRight.className = "header-right";
        headerRight.append(status, securityEl);

        header.append(icon, info, headerRight);

        // Volume list
        const volumeList = document.createElement("div");
        volumeList.className = "volume-list";

        card.append(header, volumeList);

        this._setContent(card);

        this._header = header;
        this._summaryRow1 = summaryRow1;
        this._security = securityEl;
        this._rxValue = rxItem.value;
        this._txValue = txItem.value;
        this._status = status;
        this._volumeList = volumeList;

        // Bouw de volumestructuur één keer op om knipperen bij updates te voorkomen
        this._buildVolumeList();
        this._update();
      }

  
      _getDeviceInfo(entityId) {
        if (!entityId || !this._hass) return null;

        const entity = this._hass.entities?.[entityId];
        const deviceId = entity?.device_id;

        if (!deviceId) return null;

        const device = this._hass.devices?.[deviceId];

        if (!device) return null;

        const manufacturer = device.manufacturer?.trim();
        const model = (device.model || device.model_id)?.trim();

        return [manufacturer, model]
          .filter(Boolean)
          .join(" ") || null;
      }

      _getSecurityStatus() {
        const value = this._getValue(this._config.security);

        if (value === null) {
          return { label: this._t("status.unknown"), type: "unknown" };
        }

        if (value === "off" || value === "on") {
          return {
            label: value === "on" ? this._t("status.warning") : this._t("status.safe"),
            type: value === "on" ? "error" : "normal"
          };
        }

        const normalized = value.toLowerCase();

        if (
          ["normal", "safe", "ok", "secure", "veilig"].includes(normalized)
        ) {
          return { label: this._t("status.safe"), type: "normal" };
        }

        if (
          ["warning", "warn", "alert", "problem", "unsafe"].includes(normalized)
        ) {
          return { label: this._t("status.warning"), type: "error" };
        }

        return { label: value, type: "unknown" };
      }

      _getDiskStatus(entityId) {
        const value = this._getValue(entityId);

        if (value === null) {
          return { label: this._t("status.unknown"), type: "unknown" };
        }

        const normalized = value.toLowerCase();

        if (
          ["normal", "healthy", "ok", "initialized", "active"].includes(normalized)
        ) {
          return { label: this._t("status.normal"), type: "normal" };
        }

        if (
          ["warning", "attention", "degraded", "repairing"].includes(normalized)
        ) {
          return { label: this._t("status.warning"), type: "warning" };
        }

        if (
          ["critical", "crashed", "failing", "failed", "error"].includes(normalized)
        ) {
          return { label: this._t("status.error"), type: "error" };
        }

        return { label: value, type: "unknown" };
      }

      // Eenmalige opbouw van de DOM-elementen van de volumelijst
      _buildVolumeList() {
        this._volumeList.replaceChildren();
        this._volumeElements = [];

        if (!this._config.volumes.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = this._t("synology.no_volumes");
          this._volumeList.append(empty);
          return;
        }

        this._config.volumes.forEach((volume, index) => {
          const volumeWrapper = document.createElement("div");
          volumeWrapper.className = "volume-wrapper";

          if (index > 0) {
            const divider = document.createElement("div");
            divider.className = "volume-divider";
            this._volumeList.append(divider);
          }

          const volumeRow = document.createElement("div");
          volumeRow.className = "volume-row hoverable";
          volumeRow.setAttribute("role", "button");
          volumeRow.setAttribute("tabindex", "0");

          const volumeIcon = document.createElement("ha-icon");
          volumeIcon.className = "volume-icon";
          volumeIcon.icon = "mdi:database";

          const volumeName = document.createElement("div");
          volumeName.className = "volume-name";
          volumeName.textContent = volume.name;

          const volumeUsage = document.createElement("div");
          volumeUsage.className = "volume-usage";

          const volumeState = document.createElement("div");
          volumeState.className = "volume-state";

          volumeRow.append(volumeIcon, volumeName, volumeUsage, volumeState);
          volumeWrapper.append(volumeRow);

          const disksContainer = document.createElement("div");
          disksContainer.className = "disks-container";
          disksContainer.hidden = !this._expandedVolumes[index];

          const toggleDisks = () => {
            this._expandedVolumes[index] = !this._expandedVolumes[index];
            disksContainer.hidden = !this._expandedVolumes[index];
          };

          this._onActivate(volumeRow, toggleDisks);

          const diskElements = [];
          const disks = volume.disks || [];

          for (const disk of disks) {
            const row = document.createElement("div");
            row.className = "disk-row";

            const icon = document.createElement("ha-icon");
            icon.className = "disk-icon";
            icon.icon = disk.type === "ssd" ? "mdi:sd" : "mdi:harddisk";

            const name = document.createElement("div");
            name.className = "disk-name";
            name.textContent = disk.name;

            const modelSpan = document.createElement("span");
            modelSpan.className = "disk-model";
            name.append(modelSpan);

            const temperature = document.createElement("div");
            temperature.className = "disk-temperature";
            this._makeClickable(temperature, disk.temperature);

            const state = document.createElement("div");
            state.className = "disk-state";

            row.append(icon, name, temperature, state);
            disksContainer.append(row);

            diskElements.push({ icon, modelSpan, temperature, state, diskConfig: disk });
          }

          volumeWrapper.append(disksContainer);
          this._volumeList.append(volumeWrapper);

          // Sla alle element-referenties op om later makkelijk te updaten
          this._volumeElements.push({
            volumeUsage,
            volumeState,
            modelSpans: diskElements.map(d => d.modelSpan),
            diskElements,
            volumeConfig: volume
          });
        });
      }

      // Update enkel de data/tekst in plaats van de DOM opnieuw op te bouwen
      _updateVolumeList() {
        this._volumeElements.forEach((el) => {
          const volume = el.volumeConfig;

          // Update volume sensoren
          const used = this._formatSensor(volume.used, 1);
          const size = this._formatSensor(volume.size, 1);
          el.volumeUsage.textContent = `${used} / ${size}`;

          const volumeStatus = this._getDiskStatus(volume.status);
          el.volumeState.textContent = volumeStatus.label;
          el.volumeState.className = `volume-state ${volumeStatus.type}`;

          // Update gekoppelde schijven
          el.diskElements.forEach((diskEl) => {
            const disk = diskEl.diskConfig;

            const deviceInfo = this._getDeviceInfo(disk.temperature);
            diskEl.modelSpan.textContent = deviceInfo ? ` (${deviceInfo})` : "";

            const tempValue = this._getNumber(disk.temperature);
            const tempUnit = this._getUnit(disk.temperature, "°C");
            diskEl.temperature.textContent = tempValue === null
              ? this._t("status.unknown")
              : `${this._formatNumber(tempValue, 0)} ${tempUnit}`;

            const diskStatus = this._getDiskStatus(disk.status);
            diskEl.state.textContent = diskStatus.label;

            diskEl.icon.className = `disk-icon ${diskStatus.type}`;
            diskEl.state.className = `disk-state ${diskStatus.type}`;
          });
        });
      }

      _update() {
        if (!this._hass) return;

        // Security
        const security = this._getSecurityStatus();

        // Eerste regel: CPU, RAM en temperatuur
        this._summaryItems.forEach(({ el, key, label, decimals, unit }) => {
          el.textContent =
            `${label} ${this._formatSensor(this._config[key], decimals, unit)}`;
        });

        // Beveiliging onder de statusindicator
        this._security.textContent = this._t("synology.security", { status: security.label });

        // Network traffic
        this._rxValue.textContent = this._formatSensor(
          this._config.network_rx,
          1
        );

        this._txValue.textContent = this._formatSensor(
          this._config.network_tx,
          1
        );

        // Overall NAS status
        const volumeStatuses = this._config.volumes.map(volume =>
          this._getDiskStatus(volume.status)
        );

        const diskStatuses = this._config.volumes.flatMap(volume =>
          (volume.disks || []).map(disk =>
            this._getDiskStatus(disk.status)
          )
        );

        const allStatuses = [...volumeStatuses, ...diskStatuses];

        const hasError =
          security.type === "error" ||
          allStatuses.some(status => status.type === "error");

        const hasWarning =
          allStatuses.some(status => status.type === "warning");

        const hasUnknown =
          security.type === "unknown" ||
          allStatuses.some(status => status.type === "unknown");

        let overallStatus;

        if (hasError) {
          overallStatus = { label: this._t("synology.overall.problem"), type: "error" };
        } else if (hasWarning || hasUnknown) {
          overallStatus = { label: this._t("synology.overall.check"), type: "warning" };
        } else {
          overallStatus = { label: this._t("synology.overall.normal"), type: "success" };
        }

        this._setBadge(this._status, overallStatus.type, overallStatus.label);

        // Update uitsluitend de data in de volumelijst zonder re-render
        this._updateVolumeList();
      }

      getCardSize() {
        const volumeCount = this._config.volumes.length;
        let diskCount = 0;

        this._config.volumes.forEach((volume, index) => {
          if (this._expandedVolumes[index]) {
            diskCount += (volume.disks || []).length;
          }
        });

        return Math.max(4, volumeCount + diskCount + 3);
      }
    }

    registerCard("synology-nas-card", SynologyNasCard, {
      id: "synology",
      name: "Synology NAS",
      description: "Synology NAS status, volumes and disk overview.",
      editor: {
        schema: [
          { name: "name", required: true, selector: { text: {} } },
          { name: "temperature", selector: { entity: { domain: "sensor" } } },
          { name: "security", selector: { entity: {} } },
          { name: "cpu", selector: { entity: { domain: "sensor" } } },
          { name: "memory", selector: { entity: { domain: "sensor" } } },
          { name: "network_rx", selector: { entity: { domain: "sensor" } } },
          { name: "network_tx", selector: { entity: { domain: "sensor" } } },
          { name: "volumes", selector: { object: {} } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: { name: "NAS" }
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("synology-nas-card: custom-cards-shared.js is not loaded. Add that file as a resource.");
      }
    }, 5000);
  }
})();
