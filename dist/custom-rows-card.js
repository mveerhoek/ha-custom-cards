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
    const MIN_COLUMN_WIDTH = 160; // px
    const COLUMN_GAP = 20; // px

    // Extra elementen die onder een uitgeklapte regel getoond kunnen worden
    const EXTRA_TYPES = ["media_player", "climate"];
    const DEFAULT_STEP = 0.5; // °C per klik bij een climate

    const MEDIA_ICONS = {
      tv: "mdi:television",
      speaker: "mdi:speaker",
      receiver: "mdi:audio-video"
    };

    const CLIMATE_ICONS = {
      heat: "mdi:fire",
      cool: "mdi:snowflake",
      heat_cool: "mdi:sun-snowflake-variant",
      auto: "mdi:thermostat-auto",
      dry: "mdi:water-percent",
      fan_only: "mdi:fan",
      off: "mdi:power"
    };

    const isAvailable = (state) =>
      !!state && state.state !== "unavailable" && state.state !== "unknown";

    const toNumber = (value) =>
      value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
        ? null
        : Number(value);

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
          if (entry.extras !== undefined && !Array.isArray(entry.extras)) {
            throw new Error(`Entry ${index + 1}: extras must be a list.`);
          }

          const extras = (entry.extras || []).map((extra, extraIndex) => {
            const where = `Entry ${index + 1}, extra ${extraIndex + 1}`;

            if (!extra || !EXTRA_TYPES.includes(extra.type)) {
              throw new Error(`${where}: set type to ${EXTRA_TYPES.join(" or ")}.`);
            }
            if (!extra.entity) {
              throw new Error(`${where}: set an entity using the entity option.`);
            }

            return {
              type: extra.type,
              entity: extra.entity,
              name: extra.name, // optioneel: overschrijft de naam van de entiteit
              icon: extra.icon, // optioneel: overschrijft het icoon van de knop
              step: Number(extra.step) > 0 ? Number(extra.step) : DEFAULT_STEP // alleen climate
            };
          });

          return {
            name: entry.name,
            icon: entry.icon,
            switch: entry.switch, // optioneel: schakelaar of lamp
            temperature: entry.temperature,
            humidity: entry.humidity,
            power: entry.power,
            extras
          };
        });

        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          entries
        };

        this._expanded = new Set();

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

        this._rows = this._config.entries.map((entry, index) => {
          const el = document.createElement("div");
          el.className = "entry";

          const head = document.createElement("div");
          head.className = "entry-head";

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

            // stopPropagation: schakelen klapt de regel niet uit
            this._onActivate(iconWrap, () => this._toggle(entry.switch), { stopPropagation: true });
          }

          const info = document.createElement("div");
          info.className = "entry-info";

          const name = document.createElement("div");
          name.className = "entry-name";
          name.textContent = entry.name;

          info.append(name);

          // Tweede regel: alleen de geconfigureerde waarden, gescheiden door een punt
          const values = [];
          const defs = VALUES.filter((def) => entry[def.key]);

          if (defs.length) {
            const summary = document.createElement("div");
            summary.className = "entry-summary";

            const row = document.createElement("div");
            row.className = "summary-row";

            defs.forEach((def, valueIndex) => {
              if (valueIndex > 0) {
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

          head.append(iconWrap, info);
          el.append(head);

          // Extra elementen: onder de kop, zichtbaar na een klik op de regel
          let extrasEl = null;
          let extras = [];

          if (entry.extras.length) {
            const chevron = document.createElement("ha-icon");
            chevron.className = "entry-chevron";
            chevron.icon = "mdi:chevron-down";
            head.append(chevron);

            extrasEl = document.createElement("div");
            extrasEl.className = "entry-extras";
            extrasEl.hidden = true;

            extras = entry.extras.map((extra) =>
              extra.type === "climate" ? this._buildClimate(extra) : this._buildMedia(extra)
            );
            extrasEl.append(...extras.map((extra) => extra.el));
            el.append(extrasEl);

            head.classList.add("expandable");
            head.setAttribute("role", "button");
            head.setAttribute("tabindex", "0");
            this._onActivate(head, () => this._toggleExpanded(index));
          }

          const row = { el, head, extrasEl, entry, iconWrap, values, extras };

          this._applyOpen(row, this._expanded.has(index));

          return row;
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

      // Plaatst de regels in het raster, met een scheidingslijn na iedere volle rij.
      // Een uitgeklapte regel krijgt een eigen rij over de volle breedte.
      _applyLayout(columns) {
        this._columns = columns;
        this._grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

        const children = [];
        const lastIndex = this._rows.length - 1;
        let column = 0; // aantal gevulde kolommen in de huidige rij

        const addDivider = () => {
          const divider = document.createElement("div");
          divider.className = "divider";
          children.push(divider);
        };

        this._rows.forEach((row, index) => {
          const open = !!row.extrasEl && this._expanded.has(index);

          // Een uitgeklapte regel begint op een nieuwe rij
          if (open && column !== 0) {
            addDivider();
            column = 0;
          }

          row.el.style.gridColumn = open ? "1 / -1" : "";
          children.push(row.el);

          column = open ? columns : column + 1;

          if (column >= columns) {
            column = 0;
            if (index !== lastIndex) addDivider();
          }
        });

        this._grid.replaceChildren(...children);
      }

      // ----- Uit- en inklappen -----

      _toggleExpanded(index) {
        const open = !this._expanded.has(index);

        if (open) this._expanded.add(index);
        else this._expanded.delete(index);

        this._applyOpen(this._rows[index], open);

        // De regels worden opnieuw geplaatst; het element met focus houdt die focus
        const focused = this.shadowRoot.activeElement;

        this._applyLayout(this._columns);
        focused?.focus?.();
      }

      _applyOpen(row, open) {
        if (!row.extrasEl) return;

        row.el.classList.toggle("open", open);
        row.extrasEl.hidden = !open;
        row.head.setAttribute("aria-expanded", String(open));
      }

      // ----- Hulpfuncties -----

      _toggle(entityId) {
        const state = this._getState(entityId);

        if (!this._hass || !state || state.state === "unavailable") return;

        this._callService("homeassistant", "toggle", { entity_id: entityId });
      }

      async _callService(domain, service, data) {
        if (!this._hass) return;

        try {
          await this._hass.callService(domain, service, data);
        } catch (err) {
          console.error(`${this.localName}: ${domain}.${service} failed:`, err);
        }
      }

      // Status als leesbare (vertaalde) tekst
      _stateText(state) {
        return this._hass?.formatEntityState ? this._hass.formatEntityState(state) : state.state;
      }

      _formatNumber1(value) {
        try {
          return value.toLocaleString(this._language, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          });
        } catch (err) {
          return value.toFixed(1);
        }
      }

      // Lang indrukken (standaard een halve seconde). Knoppen en de slider in het element
      // doen niet mee; bij bewegen (scrollen) of loslaten vooraf wordt het afgebroken.
      _onLongPress(element, handler, { delay = 500 } = {}) {
        let timer = null;
        let startX = 0;
        let startY = 0;

        const cancel = () => {
          clearTimeout(timer);
          timer = null;
        };

        element.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.target.closest("button, input")) return;

          cancel();
          startX = event.clientX;
          startY = event.clientY;

          timer = setTimeout(() => {
            timer = null;
            navigator.vibrate?.(30);
            handler();
          }, delay);
        });

        element.addEventListener("pointermove", (event) => {
          if (timer && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
        });

        ["pointerup", "pointercancel", "pointerleave"].forEach((type) =>
          element.addEventListener(type, cancel)
        );

        // Voorkomt het contextmenu dat een lange druk op touchscreens kan openen
        element.addEventListener("contextmenu", (event) => event.preventDefault());
      }

      // Ronde icoonknop; geeft het element en een functie om het icoon te wisselen
      _iconButton(onClick) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "icon-btn";

        const icon = document.createElement("ha-icon");
        el.append(icon);
        el.addEventListener("click", onClick);

        return {
          el,
          setIcon: (name) => {
            if (icon.icon !== name) icon.icon = name;
          }
        };
      }

      // ----- Extra element: mediaspeler -----

      _buildMedia(extra) {
        const el = document.createElement("div");
        el.className = "extra";

        const main = document.createElement("div");
        main.className = "extra-view";

        const volumeView = document.createElement("div");
        volumeView.className = "extra-view";
        volumeView.hidden = true;

        const showVolume = (show) => {
          main.hidden = show;
          volumeView.hidden = !show;
        };

        // Hoofdweergave: icoon (more-info) | bron-info | play/pause | volume
        const info = this._iconButton(() => this._openMoreInfo(extra.entity));

        const label = document.createElement("div");
        label.className = "extra-label";

        const play = this._iconButton(() =>
          this._callService("media_player", "media_play_pause", { entity_id: extra.entity })
        );

        const volume = this._iconButton(() => showVolume(true));

        main.append(info.el, label, play.el, volume.el);

        // Volumeweergave: mute | slider | annuleren
        const mute = this._iconButton(() => {
          const muted = this._getState(extra.entity)?.attributes?.is_volume_muted === true;

          this._callService("media_player", "volume_mute", {
            entity_id: extra.entity,
            is_volume_muted: !muted
          });
        });

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.step = "1";
        slider.className = "volume-slider";

        const cancel = this._iconButton(() => showVolume(false));
        cancel.setIcon("mdi:close");

        volumeView.append(mute.el, slider, cancel.el);
        el.append(main, volumeView);

        // Tijdens het slepen overschrijft een statusupdate de slider niet; het volume
        // wordt hooguit ongeveer 8 keer per seconde doorgegeven.
        const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0 };

        slider.addEventListener("input", () => {
          control.dragging = true;
          clearTimeout(control.dragTimer);
          control.dragTimer = setTimeout(() => { control.dragging = false; }, 1500);

          control.level = Number(slider.value);

          if (!control.sendTimer) {
            control.sendTimer = setTimeout(() => {
              control.sendTimer = null;

              this._callService("media_player", "volume_set", {
                entity_id: extra.entity,
                volume_level: control.level / 100
              });
            }, 120);
          }
        });

        const update = () => {
          const state = this._getState(extra.entity);
          const attrs = state?.attributes || {};
          const active = isAvailable(state) && state.state !== "off";

          info.setIcon(extra.icon || attrs.icon || MEDIA_ICONS[attrs.device_class] || "mdi:speaker");

          // Bron-info: artiest en titel; zonder die de bron, anders de status
          const track = [attrs.media_artist, attrs.media_title].filter(Boolean).join(" – ");
          const text = track || attrs.source || (state ? this._stateText(state) : "—");

          label.textContent = text;
          label.title = text;

          play.setIcon(state?.state === "playing" ? "mdi:pause" : "mdi:play");
          play.el.disabled = !active;

          const level = toNumber(attrs.volume_level);
          const volumeIcon = attrs.is_volume_muted === true ? "mdi:volume-off" : "mdi:volume-high";
          const noVolume = !active || level === null;

          volume.setIcon(volumeIcon);
          volume.el.disabled = noVolume;
          mute.setIcon(volumeIcon);
          mute.el.disabled = noVolume;
          slider.disabled = noVolume;

          if (!control.dragging && level !== null) {
            slider.value = String(Math.round(level * 100));
          }
        };

        return { el, update };
      }

      // ----- Extra element: climate -----

      _buildClimate(extra) {
        const el = document.createElement("div");
        el.className = "extra";

        const view = document.createElement("div");
        view.className = "extra-view";

        // Icoon (more-info) | naam boven status | - temperatuur +
        const info = this._iconButton(() => this._openMoreInfo(extra.entity));

        const labels = document.createElement("div");
        labels.className = "extra-labels";

        const name = document.createElement("div");
        name.className = "entry-name";

        const status = document.createElement("div");
        status.className = "extra-status";

        labels.append(name, status);

        const stepper = document.createElement("div");
        stepper.className = "stepper";

        const minus = this._iconButton(() => change(-1));
        minus.setIcon("mdi:minus");

        const value = document.createElement("div");
        value.className = "stepper-value";

        const plus = this._iconButton(() => change(1));
        plus.setIcon("mdi:plus");

        stepper.append(minus.el, value, plus.el);
        view.append(info.el, labels, stepper);
        el.append(view);

        // Lang indrukken op de rij: uit -> aan, anders -> uit
        el.classList.add("long-press");

        this._onLongPress(el, () => {
          const state = this._getState(extra.entity);

          if (!isAvailable(state)) return;

          this._callService("climate", state.state === "off" ? "turn_on" : "turn_off", {
            entity_id: extra.entity
          });
        });

        // Snel achter elkaar klikken: de gekozen waarde wordt direct getoond en na een
        // korte pauze in één keer doorgegeven aan Home Assistant.
        const control = { pending: null, sendTimer: null, clearTimer: null };

        const attributes = () => this._getState(extra.entity)?.attributes || {};

        const change = (direction) => {
          const attrs = attributes();
          const base = control.pending ?? toNumber(attrs.temperature);

          if (base === null) return;

          let next = Math.round((base + direction * extra.step) / extra.step) * extra.step;
          next = Math.round(next * 100) / 100;

          const min = toNumber(attrs.min_temp);
          const max = toNumber(attrs.max_temp);

          if (min !== null) next = Math.max(min, next);
          if (max !== null) next = Math.min(max, next);

          control.pending = next;
          clearTimeout(control.clearTimer);
          clearTimeout(control.sendTimer);
          update();

          control.sendTimer = setTimeout(async () => {
            const target = control.pending;

            await this._callService("climate", "set_temperature", {
              entity_id: extra.entity,
              temperature: target
            });

            // Even wachten tot de nieuwe status binnen is, daarna volgt het label de entiteit weer
            control.clearTimer = setTimeout(() => {
              control.pending = null;
              update();
            }, 1500);
          }, 600);
        };

        const update = () => {
          const state = this._getState(extra.entity);
          const attrs = state?.attributes || {};
          const available = isAvailable(state);

          name.textContent = extra.name || attrs.friendly_name || extra.entity;
          status.textContent = state ? this._stateText(state) : "—";

          info.setIcon(extra.icon || CLIMATE_ICONS[state?.state] || "mdi:thermostat");

          const current = control.pending ?? toNumber(attrs.temperature);
          const unit = this._hass?.config?.unit_system?.temperature || "°C";

          value.textContent = current === null ? "—" : `${this._formatNumber1(current)} ${unit}`;

          const min = toNumber(attrs.min_temp);
          const max = toNumber(attrs.max_temp);

          minus.el.disabled = !available || current === null || (min !== null && current <= min);
          plus.el.disabled = !available || current === null || (max !== null && current >= max);
        };

        return { el, update };
      }

      // ----- Bijwerken -----

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

        this._rows.forEach(({ entry, iconWrap, values, extras }) => {
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

          extras.forEach((extra) => extra.update());
        });
      }

      getCardSize() {
        return Math.max(1, Math.ceil((this._config?.entries?.length || 1) * 0.8));
      }
    }

    registerCard("custom-rows-card", CustomRowsCard, {
      id: "rows",
      name: "Custom Rows Card",
      description: "One row per entry: icon, name, optional switch/light, sensor values and expandable media player / climate controls.",
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
