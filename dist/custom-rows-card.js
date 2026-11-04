// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    // Optionele waarden op de tweede regel, in de volgorde waarin ze getoond worden
    const VALUES = [
      { key: "temperature", decimals: 1, unit: "°C" },
      { key: "humidity", decimals: 0, unit: "%" },
      { key: "power", decimals: 0, unit: "W" }
    ];

    // Twee kolommen zodra beide minstens MIN_COLUMN_WIDTH breed kunnen zijn
    const MIN_COLUMN_WIDTH = 260; // px
    const COLUMN_GAP = 24; // px

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

      connectedCallback() {
        if (this._observer && this._grid) this._observer.observe(this._grid);
      }

      disconnectedCallback() {
        this._observer?.disconnect();
      }

      _build() {
        if (!this._ensureShadow()) return;

        this._observer?.disconnect();

        const card = document.createElement("ha-card");

        const grid = document.createElement("div");
        grid.className = "entries";
        grid.style.columnGap = `${COLUMN_GAP}px`;

        this._rows = this._config.entries.map((entry) => {
          const el = document.createElement("div");
          el.className = "entry";

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

          const info = document.createElement("div");
          info.className = "entry-info";

          // Naam (bold); bij een schakelaar opent een klik het more-info dialoog
          const name = document.createElement("div");
          name.className = "entry-name";
          name.textContent = entry.name;
          this._makeClickable(name, entry.switch);

          info.append(name);

          // Tweede regel: alleen de geconfigureerde waarden, gescheiden door een punt
          const values = [];
          const defs = VALUES.filter((def) => entry[def.key]);

          if (defs.length) {
            const summary = document.createElement("div");
            summary.className = "entry-summary";

            const row = document.createElement("div");
            row.className = "summary-row";

            defs.forEach((def, index) => {
              if (index > 0) {
                const separator = document.createElement("span");
                separator.textContent = "·";
                row.append(separator);
              }

              const valueEl = document.createElement("span");
              this._makeClickable(valueEl, entry[def.key]);
              row.append(valueEl);
              values.push({ el: valueEl, ...def });
            });

            summary.append(row);
            info.append(summary);
          }

          el.append(iconWrap, info);

          return { el, entry, iconWrap, values };
        });

        card.append(grid);
        this._grid = grid;

        this._setContent(card);

        // Aantal kolommen volgt de breedte van de kaart
        this._columns = null;
        this._applyLayout(1);

        this._observer = new ResizeObserver((records) => {
          const width = records[0].contentRect.width;
          const columns = width >= 2 * MIN_COLUMN_WIDTH + COLUMN_GAP ? 2 : 1;

          if (columns !== this._columns) this._applyLayout(columns);
        });
        this._observer.observe(grid);

        this._update();
      }

      // Plaatst de regels in het raster, met een scheidingslijn na iedere volle rij
      _applyLayout(columns) {
        this._columns = columns;
        this._grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

        const children = [];

        this._rows.forEach((row, index) => {
          children.push(row.el);

          const endOfRow = (index + 1) % columns === 0;
          const isLast = index === this._rows.length - 1;

          if (endOfRow && !isLast) {
            const divider = document.createElement("div");
            divider.className = "divider";
            children.push(divider);
          }
        });

        this._grid.replaceChildren(...children);
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
            el.textContent = this._formatValue(entry[key], decimals, unit);
          });
        });
      }

      getCardSize() {
        return Math.max(1, Math.ceil((this._config?.entries?.length || 1) * 0.8));
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
