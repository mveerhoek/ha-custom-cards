// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    // Kleuren per linksnelheid, per thema (aflopend gesorteerd: de eerste snelheid die past wint)
    const LINK_SPEEDS = [
      { mbit: 10000, label: "10 Gbit/s",
        dark: { color: "#4F46E5", text: "#FFFFFF" }, light: { color: "#2563EB", text: "#FFFFFF" } },
      { mbit: 5000, label: "5 Gbit/s",
        dark: { color: "#006FFF", text: "#FFFFFF" }, light: { color: "#3B82F6", text: "#FFFFFF" } },
      { mbit: 2500, label: "2.5 Gbit/s",
        dark: { color: "#00A0DF", text: "#FFFFFF" }, light: { color: "#06B6D4", text: "#1F2937" } },
      { mbit: 1000, label: "1 Gbit/s",
        dark: { color: "#00A859", text: "#FFFFFF" }, light: { color: "#10B981", text: "#1F2937" } },
      { mbit: 100, label: "100 Mbit/s",
        dark: { color: "#EAB308", text: "#1F2937" }, light: { color: "#F59E0B", text: "#1F2937" } },
      { mbit: 10, label: "10 Mbit/s",
        dark: { color: "#D97706", text: "#FFFFFF" }, light: { color: "#E06D06", text: "#FFFFFF" } }
    ];
    const DISCONNECTED = {
      dark: { color: "#4B5563", text: "#FFFFFF" },
      light: { color: "#9CA3AF", text: "#1F2937" }
    };

    class CustomNetworkInfrastructureCard extends CardBase {
      setConfig(config) {
        this._configError = null;
        if (!config.name) {
          return this._invalidConfig("error.name");
        }

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          name: config.name,
          router_status_entity: config.router_status_entity, // Hoofd router status entiteit
          wan_ip_tracker: config.wan_ip_tracker, // Nieuw: device_tracker voor het WAN IP-adres
          networks: config.networks || [],
          devices: config.devices || []
        };

        // Houdt bij of de apparatenlijst opengeklapt is
        this._expanded = false;
        this._build();
      }

      _build() {
        if (!this._ensureShadow()) return;

        const card = document.createElement("ha-card");

        const header = document.createElement("div");
        header.className = "header hoverable";
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");

        const icon = document.createElement("ha-icon");
        icon.className = "card-icon";
        icon.icon = "mdi:lan";

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = this._config.name;

        const networksSummary = document.createElement("div");
        networksSummary.className = "networks-summary";

        info.append(title, networksSummary);

        // Rechtsboven: Aangepast naar router status-badge in plaats van tekstknop
        const routerStatusBadge = document.createElement("div");
        routerStatusBadge.className = "status-badge";
        routerStatusBadge.textContent = "—";

        // Nieuw: WAN IP onder de badge, buiten het gekleurde vlak
        const wanIp = document.createElement("div");
        wanIp.className = "wan-ip";
        wanIp.hidden = !this._config.wan_ip_tracker;

        const headerRight = document.createElement("div");
        headerRight.className = "header-right";
        headerRight.append(routerStatusBadge, wanIp);

        header.append(icon, info, headerRight);

        const devicesList = document.createElement("div");
        devicesList.className = "devices-list";
        devicesList.hidden = !this._expanded;

        card.append(header, devicesList);
        this._setContent(card);

        this._networksSummary = networksSummary;
        this._devicesList = devicesList;
        this._routerStatusBadge = routerStatusBadge;
        this._wanIp = wanIp;

        const toggleDevices = () => {
          this._expanded = !this._expanded;
          devicesList.hidden = !this._expanded;
        };

        this._onActivate(header, toggleDevices);

        this._buildInfrastructure();
        this._update();
      }

      // Ook opnieuw tekenen als het thema wisselt tussen licht en donker
      _hasRelevantChanges(hass) {
        const changed = super._hasRelevantChanges(hass);
        const darkMode = hass.themes?.darkMode;
        const themeChanged = this._darkMode !== darkMode;
        this._darkMode = darkMode;
        return changed || themeChanged;
      }

      _getTrackerIp(entityId) {
        if (!entityId || !this._hass) return null;
        const state = this._hass.states[entityId];
        return state?.attributes?.ip || null;
      }

      // connected_users kan een enkele entiteit zijn (waarde = aantal gebruikers)
      // of een lijst van numerieke entiteiten (de waarden worden bij elkaar opgeteld)
      _getUsersCount(source) {
        if (Array.isArray(source)) {
          return source.reduce((total, entityId) => {
            const num = Number(this._getValue(entityId));
            return total + (Number.isFinite(num) ? num : 0);
          }, 0);
        }
        const value = this._getValue(source);
        return value !== null ? value : "0";
      }

      // Linksnelheid uit een entiteit (of een getal in de config), in Mbit/s.
      // Ondersteunt "1000", "1000 Mbps", "1 Gbps", "2,5 Gbit/s" en een eenheid in
      // het attribuut unit_of_measurement. Geeft null bij niet verbonden/onbekend.
      _getLinkSpeed(source) {
        if (source === undefined || source === null || source === "") return null;

        let raw = source;
        let unit = "";

        if (typeof source === "string") {
          const state = this._getState(source);
          if (!state) return null;
          raw = this._getValue(source);
          unit = state.attributes?.unit_of_measurement || "";
        }

        if (raw === null) return null;

        const match = String(raw).trim().match(/^([\d.,]+)\s*([a-z/]*)/i);
        if (!match) return null;

        let mbit = Number(match[1].replace(",", "."));
        if (!Number.isFinite(mbit)) return null;

        const speedUnit = match[2] || unit;
        if (/^g/i.test(speedUnit)) mbit *= 1000;
        else if (/^k/i.test(speedUnit)) mbit /= 1000;

        return LINK_SPEEDS.find((speed) => mbit >= speed.mbit) || null;
      }

      // Maakt een vierkantje klikbaar: opent het more-info dialoog (met geschiedenis)
      // van de gekoppelde sensor. Zonder sensor-entiteit blijft het vlak niet klikbaar.
      _makeLinkClickable(element, entityId) {
        if (typeof entityId !== "string" || !entityId) return;

        element.classList.add("link-clickable");
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");

        this._onActivate(element, () => this._openMoreInfo(entityId), { stopPropagation: true });
      }

      // Kleurt een vierkantje en zet de tooltip (snelheid bij hover)
      _applyLink(element, link, tooltipKey, params = {}, suffix = "") {
        const theme = this._hass?.themes?.darkMode === false ? "light" : "dark";
        const colors = (link || DISCONNECTED)[theme];
        const speedText = link ? link.label : this._t("network.link.disconnected");
        const tooltip = this._t(tooltipKey, { ...params, speed: speedText }) + suffix;

        element.style.background = colors.color;
        element.style.color = colors.text;
        element.title = tooltip;
        element.setAttribute("aria-label", tooltip);
      }

      _getDeviceIcon(type) {
        switch (String(type).toLowerCase()) {
          case "router": return "mdi:router-wireless";
          case "switch": return "mdi:switch";
          case "ap":
          case "accesspoint": return "mdi:access-point";
          default: return "mdi:server-network";
        }
      }

      _getNetworkIcon(type) {
        return String(type).toLowerCase() === "wlan" ? "mdi:wifi" : "mdi:ethernet";
      }

      _buildInfrastructure() {
        this._networkElements = [];
        this._networksSummary.replaceChildren();

        this._config.networks.forEach((net) => {
          const row = document.createElement("div");
          row.className = "network-summary-row";

          const netIcon = document.createElement("ha-icon");
          netIcon.className = "network-icon";
          netIcon.icon = this._getNetworkIcon(net.type);

          const textSpan = document.createElement("span");

          row.append(netIcon, textSpan);
          this._networksSummary.append(row);

          this._networkElements.push({ textSpan, config: net });
        });

        this._deviceElements = [];
        this._devicesList.replaceChildren();

        if (!this._config.devices.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = this._t("network.no_devices");
          this._devicesList.append(empty);
          return;
        }

        // Kolomkoppen (boven icoon en herstart-knop blijft leeg)
        const headerCell = (text, extraClass = "") => {
          const cell = document.createElement("div");
          cell.className = `device-header-cell ${extraClass}`.trim();
          cell.textContent = text;
          return cell;
        };

        this._devicesList.append(
          headerCell(""),
          headerCell(this._t("network.header.name")),
          headerCell(this._t("network.header.ip"), "col-center"),
          headerCell(this._t("label.cpu"), "col-center"),
          headerCell(this._t("label.ram"), "col-center"),
          headerCell(""),
          headerCell("")
        );

        // Dunne scheidingslijn onder de koprij
        const divider = document.createElement("div");
        divider.className = "devices-divider";
        this._devicesList.append(divider);

        this._config.devices.forEach((device) => {

          const devIcon = document.createElement("ha-icon");
          devIcon.className = "device-icon";
          devIcon.icon = this._getDeviceIcon(device.type);

          const nameDiv = document.createElement("div");
          nameDiv.className = "device-name";
          nameDiv.textContent = device.name;

          const ipSpan = document.createElement("span");
          ipSpan.className = "device-value device-ip";

          const cpuSpan = document.createElement("span");
          cpuSpan.className = "device-value col-end";

          const ramSpan = document.createElement("span");
          ramSpan.className = "device-value col-end";

          this._makeClickable(cpuSpan, device.cpu);
          this._makeClickable(ramSpan, device.memory);

          // Uplink-vlak (links van de herstart-knop); zonder uplink_speed blijft de cel leeg
          let uplinkCell;
          if (device.uplink_speed) {
            uplinkCell = document.createElement("div");
            uplinkCell.className = "link-square";
            this._makeLinkClickable(uplinkCell, device.uplink_speed);
          } else {
            uplinkCell = document.createElement("div");
          }

          // Herstart-knop (helemaal rechts); zonder restart_action blijft de cel leeg
          let restartCell;
          if (device.restart_action) {
            restartCell = document.createElement("button");
            restartCell.className = "restart-btn";
            restartCell.type = "button";
            restartCell.title = this._t("network.restart", { name: device.name });
            restartCell.setAttribute("aria-label", this._t("network.restart", { name: device.name }));

            const restartIcon = document.createElement("ha-icon");
            restartIcon.icon = "mdi:restart";
            restartCell.append(restartIcon);

            restartCell.addEventListener("click", () =>
              this._runAction(device.restart_action, this._t("network.restart_confirm", { name: device.name }))
            );
          } else {
            restartCell = document.createElement("div");
          }

          this._devicesList.append(devIcon, nameDiv, ipSpan, cpuSpan, ramSpan, uplinkCell, restartCell);

          // Tweede rij onder de apparaatnaam: een vierkantje per poort
          const portElements = [];
          const ports = Array.isArray(device.ports) ? device.ports : [];

          if (ports.length) {
            const portsRow = document.createElement("div");
            portsRow.className = "device-ports";

            ports.forEach((port) => {
              const square = document.createElement("div");
              square.className = "port-square";

              const numberSpan = document.createElement("span");
              numberSpan.textContent = port.number ?? "";

              // Bliksemicoon: vervangt het poortnummer zolang er PoE-vermogen wordt geleverd
              const poeIcon = document.createElement("ha-icon");
              poeIcon.icon = "mdi:lightning-bolt";
              poeIcon.hidden = true;

              square.append(numberSpan, poeIcon);
              this._makeLinkClickable(square, port.speed);
              portsRow.append(square);

              portElements.push({ square, numberSpan, poeIcon, config: port });
            });

            this._devicesList.append(portsRow);
          }

          this._deviceElements.push({
            ipSpan,
            cpuSpan,
            ramSpan,
            uplinkCell: device.uplink_speed ? uplinkCell : null,
            portElements,
            config: device
          });
        });
      }

      _update() {
        if (!this._hass) return;

        // Update hoofd router status rechtsboven
        const routerStatus = this._getValue(this._config.router_status_entity);
        const [routerType, routerLabel] =
          routerStatus === "on" ? ["success", this._t("status.online")] :
          routerStatus === "off" ? ["error", this._t("status.offline")] :
          ["warning", this._t("status.unknown")];

        this._setBadge(this._routerStatusBadge, routerType, routerLabel);

        // Update WAN IP (uit device_tracker entiteit)
        if (this._config.wan_ip_tracker) {
          const wanIp = this._getTrackerIp(this._config.wan_ip_tracker);
          this._wanIp.textContent = this._t("network.wan", { ip: wanIp || this._t("network.no_ip") });
        }

        // Live update netwerken (Connected Users)
        this._networkElements.forEach((el) => {
          const users = this._getUsersCount(el.config.connected_users);
          el.textSpan.textContent = this._t("network.users", { name: el.config.name, count: users });
        });

        // Live update apparatuur (IP via tracker, CPU & RAM)
        this._deviceElements.forEach((el) => {
          // Haal IP dynamisch op uit de device_tracker entiteit, of val terug op statische IP uit config
          const trackerIp = this._getTrackerIp(el.config.device_tracker);
          el.ipSpan.textContent = trackerIp || el.config.ip || this._t("network.no_ip");

          const cpuVal = this._getValue(el.config.cpu);
          const ramVal = this._getValue(el.config.memory);

          const cpuUnit = el.config.cpu ? (this._hass.states[el.config.cpu]?.attributes?.unit_of_measurement || "%") : "%";
          const ramUnit = el.config.memory ? (this._hass.states[el.config.memory]?.attributes?.unit_of_measurement || "%") : "%";

          el.cpuSpan.textContent = cpuVal !== null ? this._formatNumber(cpuVal, 1) + cpuUnit : "—";
          el.ramSpan.textContent = ramVal !== null ? this._formatNumber(ramVal, 0) + ramUnit : "—";

          // Uplink-snelheid van het apparaat
          if (el.uplinkCell) {
            this._applyLink(el.uplinkCell, this._getLinkSpeed(el.config.uplink_speed), "network.uplink");
          }

          // Poorten (zonder snelheid of kleur: niet verbonden)
          el.portElements.forEach(({ square, numberSpan, poeIcon, config }) => {
            // PoE-vermogen (optioneel): alleen tonen als de waarde groter is dan 0
            let poeSuffix = "";
            let poeActive = false;

            if (config.poe_power) {
              const poeValue = Number(this._getValue(config.poe_power));
              if (Number.isFinite(poeValue) && poeValue > 0) {
                const poeUnit = this._hass.states[config.poe_power]?.attributes?.unit_of_measurement || "W";
                poeSuffix = `, ${this._formatNumber(poeValue, 1)} ${poeUnit}`;
                poeActive = true;
              }
            }

            numberSpan.hidden = poeActive;
            poeIcon.hidden = !poeActive;

            this._applyLink(square, this._getLinkSpeed(config.speed), "network.port_tooltip", {
              name: config.name || "",
              number: config.number ?? ""
            }, poeSuffix);
          });
        });
      }

      getCardSize() {
        const portRows = this._config.devices.filter((d) => Array.isArray(d.ports) && d.ports.length).length;
        return 3 + (this._expanded ? this._config.devices.length + 1 + Math.ceil(portRows / 2) : 0);
      }
    }

    registerCard("custom-network-infrastructure-card", CustomNetworkInfrastructureCard, {
      id: "network",
      name: "Custom Network Infrastructure Card",
      description: "Detailed network card with router status badge, connected users and an expandable list of hardware statistics and IP trackers.",
      editor: {
        schema: [
          { name: "name", required: true, selector: { text: {} } },
          { name: "router_status_entity", selector: { entity: {} } },
          { name: "wan_ip_tracker", selector: { entity: { domain: "device_tracker" } } },
          { name: "networks", selector: { object: {} } },
          { name: "devices", selector: { object: {} } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: { name: "Netwerk" }
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("custom-network-infrastructure-card: custom-cards-shared.js is not loaded. Add that file as a resource.");
      }
    }, 5000);
  }
})();
