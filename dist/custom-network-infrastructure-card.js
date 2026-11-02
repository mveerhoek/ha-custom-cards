// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    class CustomNetworkInfrastructureCard extends CardBase {
      setConfig(config) {
        if (!config.name) {
          throw new Error("Geef een naam op via name.");
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
          empty.textContent = "Geen apparatuur geconfigureerd";
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
          headerCell("Name"),
          headerCell("IP", "col-center"),
          headerCell("CPU", "col-center"),
          headerCell("RAM", "col-center"),
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

          // Herstart-knop (helemaal rechts); zonder restart_action blijft de cel leeg
          let restartCell;
          if (device.restart_action) {
            restartCell = document.createElement("button");
            restartCell.className = "restart-btn";
            restartCell.type = "button";
            restartCell.title = `Herstart ${device.name}`;
            restartCell.setAttribute("aria-label", `Herstart ${device.name}`);

            const restartIcon = document.createElement("ha-icon");
            restartIcon.icon = "mdi:restart";
            restartCell.append(restartIcon);

            restartCell.addEventListener("click", () =>
              this._runAction(device.restart_action, device.name, "herstarten")
            );
          } else {
            restartCell = document.createElement("div");
          }

          this._devicesList.append(devIcon, nameDiv, ipSpan, cpuSpan, ramSpan, restartCell);

          this._deviceElements.push({ ipSpan, cpuSpan, ramSpan, config: device });
        });
      }

      _update() {
        if (!this._hass) return;

        // Update hoofd router status rechtsboven
        const routerStatus = this._getValue(this._config.router_status_entity);
        const [routerType, routerLabel] =
          routerStatus === "on" ? ["success", "Online"] :
          routerStatus === "off" ? ["error", "Offline"] :
          ["warning", "Onbekend"];

        this._setBadge(this._routerStatusBadge, routerType, routerLabel);

        // Update WAN IP (uit device_tracker entiteit)
        if (this._config.wan_ip_tracker) {
          const wanIp = this._getTrackerIp(this._config.wan_ip_tracker);
          this._wanIp.textContent = `WAN: ${wanIp || "Geen IP"}`;
        }

        // Live update netwerken (Connected Users)
        this._networkElements.forEach((el) => {
          const users = this._getUsersCount(el.config.connected_users);
          el.textSpan.textContent = `${el.config.name}: ${users} gebruikers`;
        });

        // Live update apparatuur (IP via tracker, CPU & RAM)
        this._deviceElements.forEach((el) => {
          // Haal IP dynamisch op uit de device_tracker entiteit, of val terug op statische IP uit config
          const trackerIp = this._getTrackerIp(el.config.device_tracker);
          el.ipSpan.textContent = trackerIp || el.config.ip || "Geen IP";

          const cpuVal = this._getValue(el.config.cpu);
          const ramVal = this._getValue(el.config.memory);

          const cpuUnit = el.config.cpu ? (this._hass.states[el.config.cpu]?.attributes?.unit_of_measurement || "%") : "%";
          const ramUnit = el.config.memory ? (this._hass.states[el.config.memory]?.attributes?.unit_of_measurement || "%") : "%";

          el.cpuSpan.textContent = cpuVal !== null ? this._formatNumber(cpuVal, 1) + cpuUnit : "—";
          el.ramSpan.textContent = ramVal !== null ? this._formatNumber(ramVal, 0) + ramUnit : "—";
        });
      }

      getCardSize() {
        return 3 + (this._expanded ? this._config.devices.length + 1 : 0);
      }
    }

    registerCard("custom-network-infrastructure-card", CustomNetworkInfrastructureCard, {
      name: "Custom Network Infrastructure Card",
      description: "Gedetailleerde netwerkkaart met router status badge, aangesloten gebruikers en een uitklapbare lijst met hardware statistieken en IP trackers.",
      editor: {
        schema: [
          { name: "name", required: true, selector: { text: {} } },
          { name: "router_status_entity", selector: { entity: {} } },
          { name: "wan_ip_tracker", selector: { entity: { domain: "device_tracker" } } },
          { name: "networks", selector: { object: {} } },
          { name: "devices", selector: { object: {} } },
          { name: "css_url", selector: { text: {} } }
        ],
        labels: {
          name: "Naam",
          router_status_entity: "Router status (on/off)",
          wan_ip_tracker: "Device tracker voor het WAN IP-adres",
          networks: "Netwerken (YAML-lijst)",
          devices: "Apparaten (YAML-lijst)",
          css_url: "Pad naar stylesheet (optioneel)"
        },
        helpers: {
          wan_ip_tracker: "Het IP-adres wordt gelezen uit het attribuut ip.",
          networks: "Per netwerk: name, type (wlan of lan) en connected_users.",
          devices: "Per apparaat: name, type, device_tracker, cpu, memory en restart_action.",
          css_url: "Alleen nodig als custom-cards-shared.css niet naast de scripts staat."
        },
        example: [
          "networks:",
          "  - name: WiFi",
          "    type: wlan                          # wlan of lan",
          "    connected_users: sensor.wifi_users  # of een lijst met sensoren (wordt opgeteld)",
          "devices:",
          "  - name: Router",
          "    type: router                        # router, switch of ap",
          "    device_tracker: device_tracker.router",
          "    ip: 192.168.1.1                     # alleen zonder device_tracker",
          "    cpu: sensor.router_cpu",
          "    memory: sensor.router_memory",
          "    restart_action:",
          "      action: perform-action",
          "      perform_action: button.press",
          "      target:",
          "        entity_id: button.router_restart"
        ].join("\n")
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
        console.error("custom-network-infrastructure-card: custom-cards-shared.js is niet geladen. Voeg dat bestand toe als resource.");
      }
    }, 5000);
  }
})();
