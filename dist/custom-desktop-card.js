// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    class CustomDesktopCard extends CardBase {
      setConfig(config) {
        this._configError = null;
        if (!config.name) {
          return this._invalidConfig("error.name");
        }

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          name: config.name,
          device_tracker: config.device_tracker, // Nieuw: device tracker voor de statusindicator
          cpu: config.cpu,
          memory: config.memory,
          temperature: config.temperature,
          storage_used: config.storage_used,
          storage_free: config.storage_free
        };

        this._build();
      }

      _build() {
        if (!this._ensureShadow()) return;

        const card = document.createElement("ha-card");

        const header = document.createElement("div");
        header.className = "header";

        const icon = document.createElement("ha-icon");
        icon.className = "card-icon";
        icon.icon = "mdi:desktop-tower";

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("div");
        title.className = "card-title";
        title.textContent = this._config.name;

        const summary = document.createElement("div");
        summary.className = "card-summary";

        const summaryRow1 = document.createElement("div");
        summaryRow1.className = "summary-row";

        // CPU, RAM en temperatuur: elk apart klikbaar
        this._summaryItems = this._createSystemSummary(summaryRow1);

        const summaryRow2 = document.createElement("div");
        summaryRow2.className = "summary-row";

        summary.append(summaryRow1, summaryRow2);
        info.append(title, summary);

        // Statusindicator rechtsboven (device tracker)
        const status = document.createElement("div");
        status.className = "status-badge";
        status.textContent = "—";

        header.append(icon, info, status);
        card.append(header);

        this._setContent(card);

        this._summaryRow1 = summaryRow1;
        this._status = status;
        this._summaryRow2 = summaryRow2;

        this._update();
      }

      _getTrackerStatus() {
        const value = this._getValue(this._config.device_tracker);

        if (value === null) {
          return { label: this._t("status.unknown"), type: "warning" };
        }

        const normalized = value.toLowerCase();

        if (["home", "on", "connected"].includes(normalized)) {
          return { label: this._t("status.online"), type: "success" };
        }

        if (["not_home", "off", "disconnected"].includes(normalized)) {
          return { label: this._t("status.offline"), type: "error" };
        }

        return { label: this._t("status.unknown"), type: "warning" };
      }

      _update() {
        if (!this._hass) return;

        // Statusindicator: device tracker (home = online, not_home = offline)
        const trackerStatus = this._getTrackerStatus();
        this._setBadge(this._status, trackerStatus.type, trackerStatus.label);

        // Rij 1: CPU, RAM en Temperatuur
        this._updateSystemSummary();

        // Rij 2: Opslagberekening (Gebruikt / Totaal)
        const usedVal = this._getNumber(this._config.storage_used);
        const freeVal = this._getNumber(this._config.storage_free);
        const unit = this._getUnit(this._config.storage_used, "GB");

        let storageValue = this._t("status.unknown");

        if (usedVal !== null && freeVal !== null) {
          const totalVal = usedVal + freeVal;
          // Bepaal decimalen op basis van de eenheid (TB heeft vaak 1 of 2 decimalen nodig, GB meestal 0 of 1)
          const decimals = unit.toLowerCase() === "tb" ? 2 : 1;

          storageValue = `${usedVal.toFixed(decimals)} ${unit} / ${totalVal.toFixed(decimals)} ${unit}`;
        } else if (usedVal !== null) {
          // Fallback als alleen 'used' beschikbaar is
          storageValue = `${usedVal.toFixed(1)} ${unit} / ${this._t("status.unknown")}`;
        }

        const storageText = this._t("desktop.storage", { value: storageValue });

        this._summaryRow2.textContent = storageText;
      }

      getCardSize() {
        return 2; 
      }
    }

    registerCard("custom-desktop-card", CustomDesktopCard, {
      id: "desktop",
      name: "Custom Desktop Card",
      description: "Shows CPU, RAM, temperature and storage (used / total) in a minimalist style.",
      editor: {
        schema: [
          { name: "name", required: true, selector: { text: {} } },
          { name: "device_tracker", selector: { entity: { domain: "device_tracker" } } },
          { name: "cpu", selector: { entity: { domain: "sensor" } } },
          { name: "memory", selector: { entity: { domain: "sensor" } } },
          { name: "temperature", selector: { entity: { domain: "sensor" } } },
          { name: "storage_used", selector: { entity: { domain: "sensor" } } },
          { name: "storage_free", selector: { entity: { domain: "sensor" } } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: { name: "Desktop" }
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("custom-desktop-card: custom-cards-shared.js is not loaded. Add that file as a resource.");
      }
    }, 5000);
  }
})();
