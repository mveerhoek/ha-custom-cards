// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    // Optionele waarden achter de naam, in de volgorde waarin ze getoond worden
    const VALUES = [
      { key: "temperature", decimals: 1, unit: "°C" },
      { key: "humidity", decimals: 0, unit: "%" },
      { key: "power", decimals: 0, unit: "W" }
    ];

    class CustomRowsCard extends CardBase {
      setConfig(config) {
        if (!Array.isArray(config.entries) || !config.entries.length) {
          throw new Error("Set a list of entries using the entries option.");
        }

        const entries = config.entries.map((entry, index) => {
          if (!entry || !entry.name) {
            throw new Error(`Entry ${index + 1}: set a name using the name option.`);
          }
          if (!entry.icon) {
            throw new Error(`Entry ${index + 1}: set an icon using the icon option.`);
          }

          return {
            name: entry.name,
            icon: entry.icon,
            switch: entry.switch, // optioneel: schakelaar of lamp
            temperature: entry.temperature,
            humidity: entry.humidity,
            power: entry.power
          };
        });

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          entries
        };

        this._build();
      }

      _build() {
        if (!this._ensureShadow()) return;

        const card = document.createElement("ha-card");

        const grid = document.createElement("div");
        grid.className = "entries";

        // Alleen kolommen voor waarden die minstens één entry gebruikt. Alle regels delen
        // dezelfde kolommen, dus de waarden staan onder elkaar uitgelijnd.
        const activeValues = VALUES.filter((def) =>
          this._config.entries.some((entry) => entry[def.key])
        );

        grid.style.gridTemplateColumns =
          ["auto", "minmax(0, max-content)", ...activeValues.map(() => "auto")].join(" ");

        this._rows = this._config.entries.map((entry) => {
          const row = document.createElement("div");
          row.className = "entry";

          // Icoon (grijs); met schakelaar ook een cirkel die klikbaar is
          const iconWrap = document.createElement("div");
          iconWrap.className = "entry-icon";

          const icon = document.createElement("ha-icon");
          icon.icon = entry.icon;
          iconWrap.append(icon);

          if (entry.switch) {
            iconWrap.classList.add("switchable");
            iconWrap.setAttribute("role", "switch");
            iconWrap.setAttribute("tabindex", "0");
            iconWrap.setAttribute("aria-label", entry.name);

            this._onActivate(iconWrap, () => this._toggle(entry.switch));
          }

          // Naam (bold); bij een schakelaar opent een klik het more-info dialoog
          const name = document.createElement("div");
          name.className = "entry-name";
          name.textContent = entry.name;
          this._makeClickable(name, entry.switch);

          row.append(iconWrap, name);

          // Waarden: altijd een cel per actieve kolom, ook als deze entry de waarde niet heeft
          const values = activeValues.map((def) => {
            const el = document.createElement("div");
            el.className = "entry-value col-end";
            this._makeClickable(el, entry[def.key]);
            row.append(el);

            return { el, ...def };
          });

          grid.append(row);

          return { entry, iconWrap, values };
        });

        card.append(grid);

        this._setContent(card);
        this._update();
      }

      _toggle(entityId) {
        const state = this._getState(entityId);

        if (!this._hass || !state || state.state === "unavailable") return;

        this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
      }

      _formatValue(entityId, decimals, fallbackUnit) {
        const value = this._getNumber(entityId);

        if (value === null) return "—";

        const unit = this._getUnit(entityId, fallbackUnit);
        let text;

        try {
          text = value.toLocaleString(this._language, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          });
        } catch (err) {
          text = value.toFixed(decimals);
        }

        return unit ? `${text} ${unit}` : text;
      }

      _update() {
        if (!this._hass || !this._rows) return;

        this._rows.forEach(({ entry, iconWrap, values }) => {
          if (entry.switch) {
            const state = this._getState(entry.switch);
            const isOn = state?.state === "on";

            iconWrap.classList.toggle("on", isOn);
            iconWrap.classList.toggle("unavailable", !state || state.state === "unavailable");
            iconWrap.setAttribute("aria-checked", String(isOn));
          }

          values.forEach(({ el, key, decimals, unit }) => {
            el.textContent = entry[key] ? this._formatValue(entry[key], decimals, unit) : "";
          });
        });
      }

      getCardSize() {
        return this._config?.entries?.length || 1;
      }
    }

    registerCard("custom-rows-card", CustomRowsCard, {
      id: "rows",
      name: "Custom Rows Card",
      description: "One row per entry: icon, name, optional switch/light and temperature, humidity and power.",
      editor: {
        schema: [
          { name: "entries", selector: { object: {} } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: {
        entries: [{ name: "Woonkamer", icon: "mdi:sofa" }]
      }
    });
  };

  // Wacht tot custom-cards-shared.js geladen is (de volgorde van laden maakt niet uit)
  if (customElements.get("custom-cards-shared")) {
    start();
  } else {
    customElements.whenDefined("custom-cards-shared").then(start);

    setTimeout(() => {
      if (!customElements.get("custom-cards-shared")) {
        console.error("custom-rows-card: custom-cards-shared.js is not loaded. Add that file as a resource.");
      }
    }, 5000);
  }
})();
