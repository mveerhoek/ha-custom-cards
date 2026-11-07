// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
(() => {
  const start = () => {
    const { CardBase, registerCard } = window.CustomCardsShared;

    // Optionele waarden op de tweede regel, in de volgorde waarin ze getoond worden
    const VALUES = [
      { key: "temperature", decimals: 1, unit: "°C" },
      { key: "humidity", decimals: 0, unit: "%" },
      { key: "illuminance", decimals: 0, unit: "lx" },
      { key: "pressure", decimals: 0, unit: "hPa" },
      { key: "power", decimals: 0, unit: "W" }
    ];

    // Twee kolommen zodra beide minstens MIN_COLUMN_WIDTH breed kunnen zijn
    const MIN_COLUMN_WIDTH = 160; // px
    const COLUMN_GAP = 20; // px

    // Extra elementen die onder een uitgeklapte regel getoond kunnen worden
    const EXTRA_TYPES = ["media_player", "climate", "power_switch", "cover", "light", "temperatures", "consumption"];
    const DEFAULT_STEP = 0.5; // °C per klik bij een climate
    const MAX_TEMPERATURES = 8; // maximaal aantal sensoren bij een temperatures-element

    // Verbruik (consumption): waarden in de volgorde van links naar rechts
    const CONSUMPTION_VALUES = [
      { key: "energy_import", icon: "mdi:transmission-tower-import", decimals: 1, unit: "kWh" },
      { key: "energy_export", icon: "mdi:transmission-tower-export", decimals: 1, unit: "kWh" },
      { key: "gas", icon: "mdi:meter-gas", decimals: 2, unit: "m³" },
      { key: "water", icon: "mdi:water", decimals: 2, unit: "m³" }
    ];

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

    // Labels (aria) van het cover-element; de rest van de kaart gebruikt de vertalingen uit custom-cards-shared.js
    const COVER_LABELS = {
      en: { toggle: "Open or close", close: "Close", open: "Open", slider: "Set position", position: "Position", back: "Back", color: "Choose colour", brightness: "Brightness" },
      nl: { toggle: "Openen of sluiten", close: "Sluiten", open: "Openen", slider: "Positie instellen", position: "Positie", back: "Terug", color: "Kleur kiezen", brightness: "Helderheid" }
    };

    const isAvailable = (state) =>
      !!state && state.state !== "unavailable" && state.state !== "unknown";

    // Wat doet een climate nu? "heating", "cooling" of null (niet actief).
    // Volgt hvac_action; heeft het toestel dat attribuut niet, dan geldt de ingestelde modus.
    const climateAction = (state) => {
      if (!isAvailable(state)) return null;

      const action = state.attributes?.hvac_action ??
        (state.state === "heat" ? "heating" : state.state === "cool" ? "cooling" : null);

      if (action === "heating" || action === "preheating") return "heating";
      if (action === "cooling") return "cooling";

      return null;
    };

    // Badges: klein statusicoon in een hoek van het hoofdicoon. Van de getoonde badges staat
    // de eerste rechtsboven en de tweede rechtsonder (volgorde van de lijst hieronder).
    // resolve geeft { icon, tone } als de badge getoond moet worden, anders null.
    const BADGE_SLOTS = ["top-right", "bottom-right"];

    const BADGES = [
      {
        applies: (entry) => entry.extras.some((extra) => extra.type === "climate"),
        resolve: (card, entry) => {
          for (const extra of entry.extras) {
            if (extra.type !== "climate") continue;

            const action = climateAction(card._getState(extra.entity));

            if (action === "heating") return { icon: "mdi:heat-wave", tone: "heat" };
            if (action === "cooling") return { icon: "mdi:snowflake", tone: "cool" };
          }

          return null;
        }
      },
      {
        // Deur: binary_sensor, aan = open, uit = dicht; onbekend of niet beschikbaar = geen badge
        applies: (entry) => !!entry.door,
        resolve: (card, entry) => {
          const state = card._getState(entry.door);

          if (!isAvailable(state)) return null;

          return state.state === "on"
            ? { icon: "mdi:door-open", tone: "door-open" }
            : { icon: "mdi:door", tone: "door-closed" };
        }
      }
    ];

    const toNumber = (value) =>
      value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
        ? null
        : Number(value);

    class CustomRowsCard extends CardBase {
      setConfig(config) {
        this._configError = null;
        if (!Array.isArray(config.entries) || !config.entries.length) {
          return this._invalidConfig("error.rows_entries");
        }

        let entries;
        try {
        entries = config.entries.map((entry, index) => {
          if (!entry || !entry.name) {
            throw { key: "error.rows_name", params: { index: index + 1 } };
          }
          if (!entry.icon) {
            throw { key: "error.rows_icon", params: { index: index + 1 } };
          }
          if (entry.extras !== undefined && !Array.isArray(entry.extras)) {
            throw { key: "error.rows_extras", params: { index: index + 1 } };
          }

          if (entry.value_order !== undefined && (
            !Array.isArray(entry.value_order) ||
            entry.value_order.some((key) => !VALUES.some((def) => def.key === key)) ||
            new Set(entry.value_order).size !== entry.value_order.length
          )) {
            throw { key: "error.rows_value_order", params: { index: index + 1 } };
          }

          const extras = (entry.extras || []).map((extra, extraIndex) => {
            const params = { index: index + 1, extra: extraIndex + 1 };

            if (!extra || !EXTRA_TYPES.includes(extra.type)) {
              throw { key: "error.rows_extra_type", params };
            }

            // temperatures: een lijst met sensoren (entities) in plaats van één entity;
            // meer dan MAX_TEMPERATURES sensoren worden genegeerd
            if (extra.type === "temperatures") {
              const entities = (Array.isArray(extra.entities) ? extra.entities : [])
                .filter((id) => typeof id === "string" && id)
                .slice(0, MAX_TEMPERATURES);

              if (!entities.length) {
                throw { key: "error.rows_extra_entity", params };
              }

              return {
                type: extra.type,
                entities,
                icon: extra.icon // optioneel: overschrijft mdi:thermometer
              };
            }

            // consumption: losse sensoren per soort (energy_import, energy_export, gas, water);
            // minstens één is nodig, niet geconfigureerde waarden worden niet getoond
            if (extra.type === "consumption") {
              const sensors = {};

              CONSUMPTION_VALUES.forEach(({ key }) => {
                if (typeof extra[key] === "string" && extra[key]) sensors[key] = extra[key];
              });

              if (!Object.keys(sensors).length) {
                throw { key: "error.rows_extra_entity", params };
              }

              return {
                type: extra.type,
                ...sensors,
                icon: extra.icon // optioneel: overschrijft mdi:counter
              };
            }

            if (!extra.entity) {
              throw { key: "error.rows_extra_entity", params };
            }

            return {
              type: extra.type,
              entity: extra.entity,
              name: extra.name, // optioneel: overschrijft de naam van de entiteit
              icon: extra.icon, // optioneel: overschrijft het icoon van de knop
              step: Number(extra.step) > 0 ? Number(extra.step) : DEFAULT_STEP, // alleen climate
              power: extra.power, // alleen power_switch: vermogenssensor (optioneel)
              status: extra.status, // alleen power_switch: binary_sensor (optioneel)
              switchable: extra.switchable === true // alleen power_switch: schakelbaar vanuit de kaart
            };
          });

          return {
            name: entry.name,
            icon: entry.icon,
            switch: entry.switch, // optioneel: schakelaar of lamp
            temperature: entry.temperature,
            humidity: entry.humidity,
            illuminance: entry.illuminance,
            pressure: entry.pressure,
            power: entry.power,
            value_order: entry.value_order,
            door: entry.door, // optioneel: binary_sensor van een deur (alleen als badge)
            extras
          };
        });

        } catch (error) {
          if (!error.key) throw error;
          return this._invalidConfig(error.key, error.params);
        }
        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          entries
        };

        this._expanded = new Set();

        this._build();
      }

      _invalidConfig(key, params) {
        this._disposeControls();
        return super._invalidConfig(key, params);
      }

      connectedCallback() {
        if (this._disposed) {
          this._disposed = false;
          this._build();
        } else if (this._observer && this._grid) this._observer.observe(this._grid);
      }

      disconnectedCallback() {
        this._disposeControls();
        this._disposed = true;
      }

      _disposeControls() {
        this._observer?.disconnect();
        (this._rows || []).forEach((row) => row.extras.forEach((extra) => extra.dispose?.()));
      }

      _build() {
        if (!this._ensureShadow()) return;

        this._disposeControls();

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

          // Badges in de hoeken van het icoon (alleen als die voor deze regel van toepassing zijn)
          const badges = BADGES.filter((def) => def.applies(entry)).map((def) => {
            const badge = document.createElement("span");
            badge.className = "entry-badge";
            badge.hidden = true;
            badge.setAttribute("aria-hidden", "true");

            const badgeIcon = document.createElement("ha-icon");
            badge.append(badgeIcon);
            iconWrap.append(badge);

            return { def, el: badge, icon: badgeIcon };
          });

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
          let summaryRowEl = null;
          // Een gedeeltelijke volgorde krijgt de overige waarden in standaardvolgorde erachter.
          const order = [...(entry.value_order || []), ...VALUES.map((def) => def.key)];
          const defs = [...new Set(order)]
            .map((key) => VALUES.find((def) => def.key === key))
            .filter((def) => entry[def.key]);

          if (defs.length) {
            const summary = document.createElement("div");
            summary.className = "entry-summary";

            const row = document.createElement("div");
            row.className = "summary-row";
            summaryRowEl = row;

            defs.forEach((def, valueIndex) => {
              let separator = null;

              if (valueIndex > 0) {
                separator = document.createElement("span");
                separator.textContent = "·";
                row.append(separator);
              }

              const valueEl = document.createElement("span");
              this._makeClickable(valueEl, entry[def.key]);
              row.append(valueEl);
              values.push({ el: valueEl, sep: separator, ...def });
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

            extras = entry.extras.map((extra) => {
              if (extra.type === "climate") return this._buildClimate(extra);
              if (extra.type === "power_switch") return this._buildPowerSwitch(extra);
              if (extra.type === "cover") return this._buildCover(extra);
              if (extra.type === "light") return this._buildLight(extra);
              if (extra.type === "temperatures") return this._buildTemperatures(extra);
              if (extra.type === "consumption") return this._buildConsumption(extra);
              return this._buildMedia(extra);
            });
            extrasEl.append(...extras.map((extra) => extra.el));
            el.append(extrasEl);

            head.classList.add("expandable");
            head.setAttribute("role", "button");
            head.setAttribute("tabindex", "0");
            this._onActivate(head, () => this._toggleExpanded(index));
          }

          const row = { el, head, extrasEl, entry, iconWrap, values, extras, badges, summaryRow: summaryRowEl };

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

          // Bij een nieuw aantal kolommen worden de regels opnieuw geplaatst (en gemeten);
          // anders kan alleen de beschikbare breedte veranderd zijn
          if (columns !== this._columns) this._applyLayout(columns);
          else this._fitSummaries();
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
        this._fitSummaries();
      }

      // Past de tweede regel (waarden) in de beschikbare breedte: van achteren af verdwijnen hele
      // waarden (met hun scheidingspunt) zodat er nooit een afgeknipte waarde zichtbaar is.
      _fitSummaries() {
        (this._rows || []).forEach(({ values, summaryRow }) => {
          if (!summaryRow || !values.length) return;

          values.forEach(({ el, sep }) => {
            el.hidden = false;
            if (sep) sep.hidden = false;
          });

          // Nog niet zichtbaar of niet gemeten: laat alles staan
          if (!summaryRow.clientWidth) return;

          for (let i = values.length - 1; i >= 0; i--) {
            if (summaryRow.scrollWidth - summaryRow.clientWidth <= 1) break;

            values[i].el.hidden = true;
            if (values[i].sep) values[i].sep.hidden = true;
          }
        });
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

      // Relatieve URL's (zoals /api/media_player_proxy/...) krijgen de basis-URL van Home Assistant
      _resolveUrl(url) {
        if (/^(https?:|data:|blob:)/i.test(url)) return url;

        return this._hass?.hassUrl ? this._hass.hassUrl(url) : url;
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
      _onLongPress(element, handler, { delay = 500, canStart = () => true } = {}) {
        let timer = null;
        let indicator = null;
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let fadeTimer = null;
        let completedIndicator = null;
        let startedAt = 0;

        const cancel = () => {
          clearTimeout(timer);
          timer = null;
          pointerId = null;
          indicator?.remove();
          indicator = null;
        };

        element.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || !event.isPrimary || event.target.closest("button, input") || !canStart()) return;
          cancel();
          pointerId = event.pointerId;
          startX = event.clientX;
          startY = event.clientY;
          const bounds = element.getBoundingClientRect();
          indicator = document.createElement("span");
          indicator.className = "long-press-indicator";
          indicator.setAttribute("aria-hidden", "true");
          // Bij touch bedekt de vinger de cirkel; die krijgt daarom een grotere uitvoering (zie CSS)
          indicator.dataset.pointer = event.pointerType || "mouse";
          startedAt = Date.now();
          indicator.style.left = `${event.clientX - bounds.left}px`;
          indicator.style.top = `${event.clientY - bounds.top}px`;
          indicator.style.animationDuration = `${delay}ms`;
          element.append(indicator);

          timer = setTimeout(() => {
            timer = null;
            pointerId = null;
            const completed = indicator;
            indicator = null;
            completedIndicator?.remove();
            clearTimeout(fadeTimer);
            completedIndicator = completed;
            completed?.classList.add("complete");
            fadeTimer = setTimeout(() => { completed?.remove(); completedIndicator = null; }, 300);
            navigator.vibrate?.(30);
            handler();
          }, delay);
        });

        element.addEventListener("pointermove", (event) => {
          if (timer && event.pointerId === pointerId && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((type) =>
          element.addEventListener(type, (event) => {
            if (event.pointerId !== pointerId) return;

            // De companion app (Android WebView) stuurt rond de houdtijd zelf een pointercancel
            // omdat het systeem een lange druk herkent. Zonder beweging is dat geen echte
            // onderbreking: laat de timer dan gewoon aflopen.
            if (type === "pointercancel" && event.pointerType !== "mouse" &&
                Date.now() - startedAt >= delay - 150) return;

            cancel();
          })
        );
        element.addEventListener("contextmenu", (event) => event.preventDefault());
        return () => { cancel(); clearTimeout(fadeTimer); completedIndicator?.remove(); };
      }

      // Ronde icoonknop; geeft het element en een functie om het icoon te wisselen
      _iconButton(onClick) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "icon-btn";

        const icon = document.createElement("ha-icon");
        el.append(icon);
        el.addEventListener("click", onClick);

        // Optionele afbeelding (bijv. albumhoes): vervangt het icoon zolang die geladen kan worden
        let img = null;
        let failedUrl = null;

        const setPicture = (url) => {
          if (url && url !== failedUrl) {
            if (!img) {
              img = document.createElement("img");
              img.className = "icon-btn-img";
              img.alt = "";
              img.draggable = false;
              img.addEventListener("error", () => {
                failedUrl = img.dataset.url;
                el.classList.remove("has-picture");
                img.removeAttribute("src");
                img.hidden = true;
              });
              el.append(img);
            }

            if (img.dataset.url !== url) {
              img.dataset.url = url;
              img.src = url;
            }

            img.hidden = false;
            el.classList.add("has-picture");
          } else {
            if (!url) failedUrl = null;
            if (img) img.hidden = true;
            el.classList.remove("has-picture");
          }
        };

        return {
          el,
          setIcon: (name) => {
            if (icon.icon !== name) icon.icon = name;
          },
          setPicture
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

        // Twee regels, net als bij de climate: dik bovenaan, normaal eronder
        const labels = document.createElement("div");
        labels.className = "extra-labels";

        const name = document.createElement("div");
        name.className = "entry-name";

        const status = document.createElement("div");
        status.className = "extra-status";

        labels.append(name, status);

        const play = this._iconButton(() =>
          this._callService("media_player", "media_play_pause", { entity_id: extra.entity })
        );

        const volume = this._iconButton(() => showVolume(true));

        main.append(info.el, labels, play.el, volume.el);

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

          // Albumhoes of andere graphic van de speler; zonder graphic blijft het icoon staan
          const picture = isAvailable(state) ? attrs.entity_picture_local || attrs.entity_picture : null;
          info.setPicture(picture ? this._resolveUrl(picture) : null);

          // Bovenste regel (dik): titel van het nummer, anders de naam van de speler.
          // Onderste regel: artiest, anders de bron (bijv. NPO Radio 2), anders de status.
          const title = attrs.media_title;
          const artist = attrs.media_artist;
          const source = attrs.source;
          const stateText = state ? this._stateText(state) : "—";

          const top = title || extra.name || attrs.friendly_name || extra.entity;
          const bottom = (title && artist) || source || stateText;

          name.textContent = top;
          name.title = top;
          status.textContent = bottom;
          status.title = bottom;

          info.el.setAttribute("aria-label", this._t("rows.more_info", { name: top }));
          play.el.setAttribute("aria-label", this._t(state?.state === "playing" ? "rows.pause" : "rows.play"));
          volume.el.setAttribute("aria-label", this._t("rows.volume"));
          mute.el.setAttribute("aria-label", this._t(attrs.is_volume_muted ? "rows.unmute" : "rows.mute"));
          slider.setAttribute("aria-label", this._t("rows.volume"));
          cancel.el.setAttribute("aria-label", this._t("rows.close"));
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

        const dispose = () => {
          clearTimeout(control.dragTimer);
          if (control.sendTimer) {
            clearTimeout(control.sendTimer);
            control.sendTimer = null;
            this._callService("media_player", "volume_set", { entity_id: extra.entity, volume_level: control.level / 100 });
          }
        };
        return { el, update, dispose };
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

        const disposeLongPress = this._onLongPress(el, () => {
          const state = this._getState(extra.entity);

          if (!isAvailable(state)) return;

          this._callService("climate", state.state === "off" ? "turn_on" : "turn_off", {
            entity_id: extra.entity
          });
        }, { canStart: () => isAvailable(this._getState(extra.entity)) });

        // Snel achter elkaar klikken: de gekozen waarde wordt direct getoond en na een
        // korte pauze in één keer doorgegeven aan Home Assistant.
        const control = { pending: null, sendTimer: null, clearTimer: null, disposed: false };

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
            control.sendTimer = null;
            const target = control.pending;

            await this._callService("climate", "set_temperature", {
              entity_id: extra.entity,
              temperature: target
            });

            if (control.disposed) return;
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

          info.el.setAttribute("aria-label", this._t("rows.more_info", { name: name.textContent }));
          minus.el.setAttribute("aria-label", this._t("rows.decrease_temperature"));
          plus.el.setAttribute("aria-label", this._t("rows.increase_temperature"));
          info.setIcon(extra.icon || CLIMATE_ICONS[state?.state] || "mdi:thermostat");

          // Kleur volgens wat het toestel nu doet (hvac_action, anders de ingestelde modus)
          const action = climateAction(state);

          info.el.classList.toggle("heating", action === "heating");
          info.el.classList.toggle("cooling", action === "cooling");

          const current = control.pending ?? toNumber(attrs.temperature);
          const unit = this._hass?.config?.unit_system?.temperature || "°C";

          value.textContent = current === null ? "—" : `${this._formatNumber1(current)} ${unit}`;

          const min = toNumber(attrs.min_temp);
          const max = toNumber(attrs.max_temp);

          minus.el.disabled = !available || current === null || (min !== null && current <= min);
          plus.el.disabled = !available || current === null || (max !== null && current >= max);
        };

        const dispose = () => {
          disposeLongPress();
          control.disposed = true;
          clearTimeout(control.clearTimer);
          if (control.sendTimer) {
            clearTimeout(control.sendTimer);
            control.sendTimer = null;
            this._callService("climate", "set_temperature", { entity_id: extra.entity, temperature: control.pending });
          }
        };
        return { el, update, dispose };
      }

      // ----- Extra element: cover (zonwering) -----

      _coverLabel(key) {
        const lang = String(this._language || "en").slice(0, 2).toLowerCase();

        return (COVER_LABELS[lang] || COVER_LABELS.en)[key];
      }

      // Hoofdweergave: [open/dicht] | naam boven status + percentage | [omlaag] [omhoog] [slider]
      // Sliderweergave: slider over de volle breedte | [terug]
      _buildCover(extra) {
        const el = document.createElement("div");
        el.className = "extra";

        const main = document.createElement("div");
        main.className = "extra-view";

        const sliderView = document.createElement("div");
        sliderView.className = "extra-view";
        sliderView.hidden = true;

        const showSlider = (show) => {
          main.hidden = show;
          sliderView.hidden = !show;
        };

        const call = (service, data = {}) =>
          this._callService("cover", service, { entity_id: extra.entity, ...data });

        // Links: schakelt tussen open en dicht
        const info = this._iconButton(() => call("toggle"));

        const labels = document.createElement("div");
        labels.className = "extra-labels";

        const name = document.createElement("div");
        name.className = "entry-name";

        const status = document.createElement("div");
        status.className = "extra-status";

        labels.append(name, status);

        // Rechts: sluiten, openen, naar de slider
        const buttons = document.createElement("div");
        buttons.className = "stepper";

        const close = this._iconButton(() => call("close_cover"));
        close.setIcon("mdi:arrow-down");

        const open = this._iconButton(() => call("open_cover"));
        open.setIcon("mdi:arrow-up");

        const swipe = this._iconButton(() => showSlider(true));
        swipe.setIcon("mdi:gesture-swipe-horizontal");

        buttons.append(close.el, open.el, swipe.el);
        main.append(info.el, labels, buttons);

        // Sliderweergave: slider (percentage open) | terug naar de hoofdweergave
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.step = "1";
        slider.className = "volume-slider";

        const back = this._iconButton(() => showSlider(false));
        back.setIcon("mdi:gesture-tap-button");

        sliderView.append(slider, back.el);
        el.append(main, sliderView);

        // Tijdens het slepen overschrijft een statusupdate de slider niet; de positie wordt
        // hooguit ongeveer 6 keer per seconde doorgegeven en bij loslaten direct. Na loslaten
        // toont de slider de gekozen positie tot de cover er is.
        const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0, target: null, holdUntil: 0 };

        const send = () => {
          clearTimeout(control.sendTimer);
          control.sendTimer = null;
          call("set_cover_position", { position: control.level });
        };

        slider.addEventListener("input", () => {
          control.dragging = true;
          clearTimeout(control.dragTimer);
          control.dragTimer = setTimeout(() => { control.dragging = false; }, 1500);

          control.level = Number(slider.value);
          control.target = control.level;

          if (!control.sendTimer) control.sendTimer = setTimeout(send, 150);
        });

        slider.addEventListener("change", () => {
          clearTimeout(control.dragTimer);
          control.dragging = false;
          control.level = Number(slider.value);
          control.target = control.level;
          control.holdUntil = Date.now() + 4000;
          send();
        });

        const update = () => {
          const state = this._getState(extra.entity);
          const attrs = state?.attributes || {};
          const available = isAvailable(state);
          const moving = state?.state === "opening" || state?.state === "closing";
          const position = toNumber(attrs.current_position);
          const title = extra.name || attrs.friendly_name || extra.entity;

          name.textContent = title;
          name.title = title;

          // Status (open, dicht, ...) en daarachter hoe ver de cover open is
          let text = state ? this._stateText(state) : "—";
          if (available && position !== null) text += ` · ${Math.round(position)}%`;

          status.textContent = text;
          status.title = text;

          info.setIcon(extra.icon || "mdi:window-open");
          info.el.disabled = !available;

          const fullyOpen = position !== null ? position >= 100 : state?.state === "open";

          close.el.disabled = !available || (!moving && state.state === "closed");
          open.el.disabled = !available || (!moving && fullyOpen);
          swipe.el.disabled = !available || position === null;
          slider.disabled = !available || position === null;

          info.el.setAttribute("aria-label", `${this._coverLabel("toggle")}: ${title}`);
          close.el.setAttribute("aria-label", this._coverLabel("close"));
          open.el.setAttribute("aria-label", this._coverLabel("open"));
          swipe.el.setAttribute("aria-label", this._coverLabel("slider"));
          slider.setAttribute("aria-label", this._coverLabel("position"));
          back.el.setAttribute("aria-label", this._coverLabel("back"));

          const holding = control.target !== null && (moving || Date.now() < control.holdUntil);

          if (!holding && !control.dragging) control.target = null;

          if (!control.dragging && position !== null) {
            slider.value = String(Math.round(holding ? control.target : position));
          }
        };

        const dispose = () => {
          clearTimeout(control.dragTimer);
          if (control.sendTimer) send();
        };

        return { el, update, dispose };
      }

      // ----- Extra element: lichtbron -----

      // Hoofdweergave: icoon (kleur van de lamp) | naam | [helderheid] [kleur] [schakelaar]
      // Sliderweergave: helderheidsslider over de volle breedte | [terug]
      _buildLight(extra) {
        const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww", "color_temp"];

        const el = document.createElement("div");
        el.className = "extra extra-power extra-light";

        const view = document.createElement("div");
        view.className = "extra-view";

        const sliderView = document.createElement("div");
        sliderView.className = "extra-view";
        sliderView.hidden = true;

        const showSlider = (show) => {
          view.hidden = show;
          sliderView.hidden = !show;
        };

        // Icoon: grijs als de lamp uit is, anders de kleur van de lamp (of oranje)
        const iconWrap = document.createElement("div");
        iconWrap.className = "power-icon light-icon";

        const iconName = extra.icon || "mdi:lightbulb";
        const icon = document.createElement("ha-icon");
        icon.icon = iconName;
        iconWrap.append(icon);

        const labels = document.createElement("div");
        labels.className = "extra-labels";

        const name = document.createElement("div");
        name.className = "entry-name";

        // Tweede regel (niet vet): helderheid in procenten, alleen bij dimbare lampen
        const intensity = document.createElement("div");
        intensity.className = "extra-status";
        intensity.hidden = true;

        labels.append(name, intensity);

        const right = document.createElement("div");
        right.className = "extra-right";

        // Helderheid: toont de slider in plaats van de rij (alleen bij dimbare lampen)
        const dim = this._iconButton(() => showSlider(true));
        dim.setIcon("mdi:gesture-swipe-horizontal");
        dim.el.hidden = true;

        // Kleur: vierkant vlak in de huidige kleur van de lamp; opent het standaard
        // Home Assistant-venster van de lamp (alleen bij lampen met kleurkeuze)
        const color = this._iconButton(() => this._openMoreInfo(extra.entity));
        color.el.classList.add("color-btn");
        color.el.hidden = true;

        const swatch = document.createElement("span");
        swatch.className = "color-swatch";
        color.el.append(swatch);

        // Schakelaar: groen als aan, grijs als uit
        const toggle = document.createElement("span");
        toggle.className = "power-toggle switchable";
        toggle.setAttribute("role", "switch");
        toggle.setAttribute("tabindex", "0");

        const toggleIcon = document.createElement("ha-icon");
        toggle.append(toggleIcon);

        this._onActivate(toggle, () => this._toggle(extra.entity), { stopPropagation: true });

        right.append(dim.el, color.el, toggle);
        view.append(iconWrap, labels, right);

        // Sliderweergave: helderheid in procenten | terug naar de hoofdweergave
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.step = "1";
        slider.className = "volume-slider";

        const back = this._iconButton(() => showSlider(false));
        back.setIcon("mdi:gesture-tap-button");

        sliderView.append(slider, back.el);
        el.append(view, sliderView);

        // Zelfde aanpak als bij de zonwering: tijdens het slepen overschrijft een update de
        // slider niet, de waarde wordt gedoseerd doorgegeven en bij loslaten direct; daarna
        // blijft de gekozen waarde even staan tot de lamp bijgewerkt is. 0% schakelt uit.
        const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0, target: null, holdUntil: 0 };

        const send = () => {
          clearTimeout(control.sendTimer);
          control.sendTimer = null;

          if (control.level <= 0) {
            this._callService("light", "turn_off", { entity_id: extra.entity });
          } else {
            this._callService("light", "turn_on", { entity_id: extra.entity, brightness_pct: control.level });
          }
        };

        slider.addEventListener("input", () => {
          control.dragging = true;
          clearTimeout(control.dragTimer);
          control.dragTimer = setTimeout(() => { control.dragging = false; }, 1500);

          control.level = Number(slider.value);
          control.target = control.level;

          if (!control.sendTimer) control.sendTimer = setTimeout(send, 150);
        });

        slider.addEventListener("change", () => {
          clearTimeout(control.dragTimer);
          control.dragging = false;
          control.level = Number(slider.value);
          control.target = control.level;
          control.holdUntil = Date.now() + 2000;
          send();
        });

        const update = () => {
          const state = this._getState(extra.entity);
          const attrs = state?.attributes || {};
          const available = !!state && state.state !== "unavailable";
          const isOn = state?.state === "on";
          const text = extra.name || attrs.friendly_name || extra.entity;

          name.textContent = text;
          name.title = text;

          if (icon.icon !== iconName) icon.icon = iconName;

          // Uit: grijs (CSS). Aan: kleur van de lamp (rgb_color); heeft de entiteit die niet
          // (bijv. een switch), dan oranje.
          const rgb = attrs.rgb_color;
          const hasRgb = isOn && Array.isArray(rgb) && rgb.length === 3 &&
            rgb.every((part) => Number.isFinite(Number(part)));
          const lampColor = hasRgb
            ? `rgb(${rgb.map((part) => Math.round(Number(part))).join(", ")})`
            : isOn ? "var(--cc-switch-color)" : "";

          iconWrap.style.color = lampColor;

          // Welke bediening de lamp ondersteunt
          const modes = Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes : [];
          const canColor = modes.some((mode) => COLOR_MODES.includes(mode));
          const canDim = modes.some((mode) => mode !== "onoff" && mode !== "unknown");

          color.el.hidden = !canColor;
          dim.el.hidden = !canDim;

          if (!canDim && !sliderView.hidden) showSlider(false);

          swatch.style.background = lampColor || "var(--disabled-text-color, #bdbdbd)";

          color.el.disabled = !available;
          dim.el.disabled = !available;
          slider.disabled = !available;

          color.el.setAttribute("aria-label", this._coverLabel("color"));
          dim.el.setAttribute("aria-label", this._coverLabel("brightness"));
          slider.setAttribute("aria-label", this._coverLabel("brightness"));
          back.el.setAttribute("aria-label", this._coverLabel("back"));

          // Helderheid in procenten (uit = 0)
          const brightness = Number(attrs.brightness);
          const level = isOn && Number.isFinite(brightness) ? Math.round((brightness / 255) * 100) : 0;
          const holding = control.target !== null && Date.now() < control.holdUntil;

          if (!holding && !control.dragging) control.target = null;

          if (!control.dragging) slider.value = String(holding ? control.target : level);

          intensity.hidden = !canDim;

          const intensityText = available ? `${level}%` : "—";

          intensity.textContent = intensityText;
          intensity.title = intensityText;

          const toggleName = isOn ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";

          if (toggleIcon.icon !== toggleName) toggleIcon.icon = toggleName;

          toggle.classList.toggle("on", isOn);
          toggle.classList.toggle("unavailable", !available);
          toggle.title = state ? this._stateText(state) : "—";
          toggle.setAttribute("aria-checked", String(isOn));
          toggle.setAttribute("aria-label", text);
        };

        const dispose = () => {
          clearTimeout(control.dragTimer);
          if (control.sendTimer) send();
        };

        return { el, update, dispose };
      }

      // ----- Extra element: temperaturen -----

      // Compacte rij: thermometer (zonder label) | per sensor [mdi:numeric-n-box] waarde
      // De eerste sensor staat links (1), de laatste rechts (maximaal 8).
      _buildTemperatures(extra) {
        const el = document.createElement("div");
        el.className = "extra extra-power extra-temperatures";

        const view = document.createElement("div");
        view.className = "extra-view";

        const iconWrap = document.createElement("div");
        iconWrap.className = "power-icon";

        const icon = document.createElement("ha-icon");
        icon.icon = extra.icon || "mdi:thermometer";
        iconWrap.append(icon);

        const right = document.createElement("div");
        right.className = "extra-right";

        const items = extra.entities.map((entityId, index) => {
          const item = document.createElement("span");
          item.className = "temperature-item";

          const numberIcon = document.createElement("ha-icon");
          numberIcon.icon = `mdi:numeric-${index + 1}-box`;

          const value = document.createElement("span");

          item.append(numberIcon, value);
          this._makeClickable(item, entityId);
          right.append(item);

          return { entityId, item, value };
        });

        view.append(iconWrap, right);
        el.append(view);

        const update = () => {
          items.forEach(({ entityId, item, value }) => {
            const text = this._formatValue(entityId, 1, "°C");

            if (value.textContent !== text) value.textContent = text;

            const title = this._getState(entityId)?.attributes?.friendly_name;

            if (title) item.title = title;
          });
        };

        return { el, update };
      }

      // ----- Extra element: verbruik -----

      // Compacte rij: teller (zonder label) | [import] [export] [gas] [water]
      // Alleen de geconfigureerde waarden worden getoond, altijd in deze volgorde.
      _buildConsumption(extra) {
        const el = document.createElement("div");
        el.className = "extra extra-power extra-consumption";

        const view = document.createElement("div");
        view.className = "extra-view";

        const iconWrap = document.createElement("div");
        iconWrap.className = "power-icon";

        const icon = document.createElement("ha-icon");
        icon.icon = extra.icon || "mdi:counter";
        iconWrap.append(icon);

        const right = document.createElement("div");
        right.className = "extra-right";

        const items = CONSUMPTION_VALUES.filter((def) => extra[def.key]).map((def) => {
          const item = document.createElement("span");
          item.className = "consumption-item";

          const itemIcon = document.createElement("ha-icon");
          itemIcon.icon = def.icon;

          const value = document.createElement("span");

          item.append(itemIcon, value);
          this._makeClickable(item, extra[def.key]);
          right.append(item);

          return { def, item, value };
        });

        view.append(iconWrap, right);
        el.append(view);

        const update = () => {
          items.forEach(({ def, item, value }) => {
            const entityId = extra[def.key];
            const text = this._formatValue(entityId, def.decimals, def.unit);

            if (value.textContent !== text) value.textContent = text;

            const title = this._getState(entityId)?.attributes?.friendly_name;

            if (title) item.title = title;
          });
        };

        return { el, update };
      }

      // ----- Extra element: stroomschakelaar -----

      // Compacte rij: icoon | naam (dik) | vermogen | status binary sensor | schakelaar
      _buildPowerSwitch(extra) {
        const el = document.createElement("div");
        el.className = "extra extra-power";

        const view = document.createElement("div");
        view.className = "extra-view";

        // Icoon: altijd grijs
        const iconWrap = document.createElement("div");
        iconWrap.className = "power-icon";

        const icon = document.createElement("ha-icon");
        icon.icon = extra.icon || "mdi:power-socket-eu";
        iconWrap.append(icon);

        const labels = document.createElement("div");
        labels.className = "extra-labels";

        const name = document.createElement("div");
        name.className = "entry-name";
        labels.append(name);

        const right = document.createElement("div");
        right.className = "extra-right";

        let power = null;

        if (extra.power) {
          power = document.createElement("span");
          power.className = "extra-value";
          this._makeClickable(power, extra.power);
          right.append(power);
        }

        // Standaardicoon van de binary sensor (afhankelijk van device class en status)
        let statusWrap = null;
        let statusIcon = null;
        const hasStateIcon = !!customElements.get("ha-state-icon");

        if (extra.status) {
          statusWrap = document.createElement("span");
          statusWrap.className = "extra-state-icon";

          statusIcon = document.createElement(hasStateIcon ? "ha-state-icon" : "ha-icon");
          statusWrap.append(statusIcon);

          this._makeClickable(statusWrap, extra.status);
          right.append(statusWrap);
        }

        // Schakelaar aan het eind van de rij: toont altijd de status van de switch,
        // en is alleen klikbaar met switchable: true
        const toggle = document.createElement("span");
        toggle.className = "power-toggle";

        const toggleIcon = document.createElement("ha-icon");
        toggle.append(toggleIcon);

        if (extra.switchable) {
          toggle.classList.add("switchable");
          toggle.setAttribute("role", "switch");
          toggle.setAttribute("tabindex", "0");

          this._onActivate(toggle, () => requestToggle(), { stopPropagation: true });
        }

        right.append(toggle);

        view.append(iconWrap, labels, right);

        // Bevestiging: vervangt de rij tijdelijk door "<naam> uitschakelen?" met een vink en een kruis
        const confirmView = document.createElement("div");
        confirmView.className = "extra-view";
        confirmView.hidden = true;

        const confirmLabels = document.createElement("div");
        confirmLabels.className = "extra-labels";

        const confirmText = document.createElement("div");
        confirmText.className = "entry-name";
        confirmLabels.append(confirmText);

        const confirmNo = this._iconButton(() => showConfirm(false));
        confirmNo.setIcon("mdi:close");

        const confirmYes = this._iconButton(() => {
          showConfirm(false);
          this._toggle(extra.entity);
        });
        confirmYes.setIcon("mdi:check");

        confirmView.append(confirmLabels, confirmNo.el, confirmYes.el);
        el.append(view, confirmView);

        let confirmTimer = null;

        const showConfirm = (show) => {
          clearTimeout(confirmTimer);
          confirmTimer = null;

          view.hidden = show;
          confirmView.hidden = !show;

          // Zonder reactie keert de rij na een paar seconden vanzelf terug
          if (show) confirmTimer = setTimeout(() => showConfirm(false), 5000);
        };

        // Uitschakelen vraagt om bevestiging zolang de binary sensor aan staat;
        // aanzetten, of uitzetten terwijl de binary sensor uit staat, gaat direct.
        const requestToggle = () => {
          const state = this._getState(extra.entity);

          if (!this._hass || !state || state.state === "unavailable") return;

          if (state.state === "on" && extra.status && this._getState(extra.status)?.state === "on") {
            showConfirm(true);
          } else {
            this._toggle(extra.entity);
          }
        };

        const update = () => {
          const state = this._getState(extra.entity);
          const isOn = state?.state === "on";
          const text = extra.name || state?.attributes?.friendly_name || extra.entity;

          name.textContent = text;
          name.title = text;

          // Vet alleen zolang de binary sensor van het apparaat aan staat
          name.style.fontWeight = extra.status && this._getState(extra.status)?.state === "on" ? "" : "400";

          const question = this._t("rows.confirm_off", { name: text });

          confirmNo.el.setAttribute("aria-label", this._t("rows.cancel"));
          confirmYes.el.setAttribute("aria-label", this._t("rows.confirm"));
          confirmText.textContent = question;
          confirmText.title = question;

          // Is de schakelaar al uit of de binary sensor inmiddels uit, dan vervalt de vraag
          if (!confirmView.hidden && (!isOn || !extra.status || this._getState(extra.status)?.state !== "on")) {
            showConfirm(false);
          }

          if (power) power.textContent = this._formatValue(extra.power, 0, "W");

          if (statusWrap) {
            const status = this._getState(extra.status);

            if (hasStateIcon) {
              statusIcon.hass = this._hass;
              statusIcon.stateObj = status;
            } else {
              const fallback = status?.attributes?.icon ||
                (status?.state === "on" ? "mdi:checkbox-marked-circle" : "mdi:radiobox-blank");

              if (statusIcon.icon !== fallback) statusIcon.icon = fallback;
            }

            statusWrap.classList.toggle("on", status?.state === "on");
            statusWrap.classList.toggle("unavailable", !status || status.state === "unavailable");
            statusWrap.title = status ? this._stateText(status) : "—";
          }

          const toggleName = isOn ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";

          if (toggleIcon.icon !== toggleName) toggleIcon.icon = toggleName;

          toggle.classList.toggle("on", isOn);
          toggle.classList.toggle("unavailable", !state || state.state === "unavailable");
          toggle.title = state ? this._stateText(state) : "—";

          if (extra.switchable) {
            toggle.setAttribute("aria-checked", String(isOn));
            toggle.setAttribute("aria-label", text);
          }
        };

        return { el, update, dispose: () => clearTimeout(confirmTimer) };
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

        let summaryChanged = false;
        this._rows.forEach(({ entry, iconWrap, values, extras, badges }) => {
          if (entry.switch) {
            const state = this._getState(entry.switch);
            const isOn = state?.state === "on";

            iconWrap.classList.toggle("on", isOn);
            iconWrap.classList.toggle("unavailable", !state || state.state === "unavailable");
            iconWrap.setAttribute("aria-checked", String(isOn));
          }

          // Getoonde badges krijgen op volgorde een hoek: eerst rechtsboven, dan rechtsonder
          let shown = 0;

          badges.forEach(({ def, el, icon }) => {
            const result = shown < BADGE_SLOTS.length ? def.resolve(this, entry) : null;

            el.hidden = !result;
            if (!result) return;

            if (icon.icon !== result.icon) icon.icon = result.icon;
            el.dataset.tone = result.tone;
            el.dataset.slot = BADGE_SLOTS[shown];
            shown++;
          });

          values.forEach(({ el, key, decimals, unit }) => {
            const text = this._formatValue(entry[key], decimals, unit);
            if (el.textContent !== text) { el.textContent = text; summaryChanged = true; }
          });

          extras.forEach((extra) => extra.update());
        });

        // Nieuwe waarden zijn mogelijk breder of smaller geworden
        if (summaryChanged) this._fitSummaries();
      }

      getCardSize() {
        return Math.max(1, Math.ceil((this._config?.entries?.length || 1) * 0.8));
      }
    }

    registerCard("custom-rows-card", CustomRowsCard, {
      id: "rows",
      name: "Custom Rows Card",
      description: "One row per entry: icon, name, optional switch/light, sensor values and expandable media player / climate / cover / light / power switch / temperatures / consumption elements.",
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
