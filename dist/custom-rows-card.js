// Vereist custom-cards-shared.js (helpers) en custom-cards-shared.css (opmaak).
// De extra elementen (extras) staan in eigen bestanden: custom-rows-extra-<naam>.js. Laad alleen de
// bestanden voor de types die je gebruikt; de volgorde van laden maakt niet uit.
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

    // Het aantal kolommen is 1, 2 of 4: twee kolommen zodra beide minstens MIN_COLUMN_WIDTH breed
    // kunnen zijn, vier kolommen zodra alle vier dat kunnen
    const MIN_COLUMN_WIDTH = 160; // px
    const COLUMN_GAP = 20; // px

    // Extra elementen die onder een uitgeklapte regel getoond kunnen worden. Elk type staat in een eigen
    // bestand (custom-rows-extra-*.js) dat zich aanmeldt in dit register: type -> { parse, build, ... }.
    // Een bestand kan later laden dan de kaart; de kaart wacht dan kort (zie _waitForExtras).
    const registry = (window.CustomRowsExtras ??= new Map());
    const EXTRAS_EVENT = "custom-rows-extras-changed";
    const EXTRAS_WAIT = 3000; // ms wachten op een extra-bestand voordat een onbekend type een fout geeft

    // Weergave van een ontbrekende of onbeschikbare waarde (een symbool, geen tekst)
    const NO_VALUE = "—";

    const isAvailable = (state) =>
      !!state && state.state !== "unavailable" && state.state !== "unknown";

    // Badges: klein statusicoon in een hoek van het hoofdicoon. Van de getoonde badges staat
    // de eerste rechtsboven, de tweede rechtsonder en de derde rechtsmidden (maximaal 3 badges,
    // alle aan de rechterkant; bij 3 badges overlappen ze elkaar een klein beetje)
    // (volgorde: statusbadges van de extras (climate), deur, daarna de badges uit de configuratie van de extras).
    // resolve geeft { icon, tone, color? } als de badge getoond moet worden, anders null.
    // tone "custom" gebruikt de meegegeven color als achtergrondcirkel.
    const BADGE_SLOTS = ["top-right", "bottom-right", "middle-right"];

    // Deur: binary_sensor, aan = open, uit = dicht; onbekend of niet beschikbaar = geen badge
    const doorBadge = {
      resolve: (card, entry) => {
        const state = card._getState(entry.door);

        if (!isAvailable(state)) return null;

        return state.state === "on"
          ? { icon: "mdi:door-open", tone: "door-open" }
          : { icon: "mdi:door", tone: "door-closed" };
      }
    };

    // Een extra-type (zie custom-rows-extra-*.js) kan op twee manieren een badge leveren:
    // - statusBadge(card, extra, helpers): { icon, tone } of null. De badge volgt de status van het
    //   extra zelf (climate: verwarmen of koelen); van de extras van een regel telt de eerste die iets toont.
    // - badge { defaultIcon, isActive(state), source?(extra) }: optionele badge uit de configuratie
    //   (power_switch, media_player), alleen zichtbaar zolang isActive waar is voor de status van de
    //   entiteit source(extra) (standaard extra.entity).
    const badgeDefs = (entry) => {
      const defOf = (extra) => registry.get(extra.type);

      const statusBadge = entry.extras.some((extra) => defOf(extra)?.statusBadge)
        ? [{
          resolve: (card) => {
            for (const extra of entry.extras) {
              const result = defOf(extra)?.statusBadge?.(card, extra, HELPERS);

              if (result) return result;
            }

            return null;
          }
        }]
        : [];

      const configured = entry.extras
        .filter((extra) => defOf(extra)?.badge && extra.badge)
        .map((extra) => {
          const { isActive, source } = defOf(extra).badge;

          return {
            resolve: (card) =>
              isActive(card._getState(source ? source(extra) : extra.entity))
                ? { icon: extra.badge.icon, tone: "custom", color: extra.badge.color }
                : null
          };
        });

      return [...statusBadge, ...(entry.door ? [doorBadge] : []), ...configured];
    };

    // Badge van een extra (power_switch of media_player): optioneel object { icon, color, use_status };
    // zonder badge geen badge. Zonder icon geldt het standaardicoon van het type.
    // use_status (alleen power_switch, vereist een status-sensor): de badge volgt de status-sensor
    // in plaats van de schakelaar.
    const parseBadge = (badge, defaultIcon) =>
      badge && typeof badge === "object" && !Array.isArray(badge)
        ? {
          icon: typeof badge.icon === "string" && badge.icon ? badge.icon : defaultIcon,
          color: typeof badge.color === "string" && badge.color.trim() ? badge.color.trim() : "var(--primary-color)",
          use_status: badge.use_status === true
        }
        : undefined;

    const toNumber = (value) =>
      value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
        ? null
        : Number(value);

    // Hulpfuncties die de extra-bestanden van de kaart meekrijgen
    const HELPERS = { isAvailable, toNumber, NO_VALUE };

    class CustomRowsCard extends CardBase {
      setConfig(config) {
        this._stopWaiting();
        this._applyConfig(config, false);
      }

      // Past de configuratie toe. Is een extra-type nog onbekend, dan kan het bestand met dat type nog
      // laden: de kaart wacht dan (zie _waitForExtras) tenzij extrasFinal gezet is (wachttijd om).
      _applyConfig(config, extrasFinal) {
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
            const type = extra && typeof extra.type === "string" ? extra.type : "";
            const def = registry.get(type);

            // Onbekend type: misschien is het bestand met dit type nog niet geladen
            if (!def) throw { key: "error.rows_extra_type", params, waitFor: !!type };

            const parsed = { ...def.parse(extra, { params }), type };

            // Optionele badge uit de configuratie (power_switch, media_player): { icon, color, use_status }
            if (def.badge) parsed.badge = parseBadge(extra.badge, def.badge.defaultIcon);

            return parsed;
          });

          // state_colors (alleen bij een input_select): lijst van { state, color }; een ongeldig
          // item wordt genegeerd, een status zonder item houdt het standaard (grijze) icoon
          const stateColors = typeof entry.switch === "string" && entry.switch.startsWith("input_select.") && Array.isArray(entry.state_colors)
            ? entry.state_colors
              .filter((item) => item && item.state !== undefined && item.state !== null && typeof item.color === "string" && item.color)
              .map((item) => ({ state: String(item.state), color: item.color }))
            : [];

          return {
            name: entry.name,
            icon: entry.icon,
            switch: entry.switch, // optioneel: schakelaar, lamp of input_select (klik = select_next)
            stateColors, // optioneel, alleen input_select: kleur van icoon en cirkel per status
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
          if (error.waitFor && !extrasFinal) return this._waitForExtras(config);
          this._stopWaiting();
          return this._invalidConfig(error.key, error.params);
        }
        this._stopWaiting();
        this._config = {
          css_url: config.css_url, // optioneel: pad naar de gedeelde stylesheet
          entries
        };

        this._expanded = new Set();

        this._build();
      }

      // Een extra-type staat in een eigen bestand dat later dan deze kaart kan laden. Zodra een
      // extra-bestand zich aanmeldt wordt de configuratie opnieuw toegepast; is het type na
      // EXTRAS_WAIT ms nog onbekend, dan volgt de foutmelding.
      _waitForExtras(config) {
        if (!this._extrasListener) {
          this._extrasListener = () => this._applyConfig(config, false);
          window.addEventListener(EXTRAS_EVENT, this._extrasListener);
        }

        if (!this._extrasTimer) {
          this._extrasTimer = setTimeout(() => {
            this._extrasTimer = null;
            this._applyConfig(config, true);
          }, EXTRAS_WAIT);
        }
      }

      _stopWaiting() {
        if (this._extrasListener) window.removeEventListener(EXTRAS_EVENT, this._extrasListener);
        clearTimeout(this._extrasTimer);
        this._extrasListener = null;
        this._extrasTimer = null;
      }

      _invalidConfig(key, params) {
        this._disposeControls();
        return super._invalidConfig(key, params);
      }

      connectedCallback() {
        if (this._disposed && this._config) {
          this._disposed = false;
          this._build();
        } else if (this._observer && this._grid) {
          this._observer.observe(this._grid);
          this._observeBands();
        }
      }

      disconnectedCallback() {
        this._disposeControls();
        this._disposed = true;
      }

      _disposeControls() {
        this._observer?.disconnect();
        this._bandObserver?.disconnect();
        cancelAnimationFrame(this._bandRefit);
        this._bandRefit = null;
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
          const badges = badgeDefs(entry).map((def) => {
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
            // Een input_select heeft geen aan/uit-status: die gedraagt zich als knop (select_next)
            const isSelect = entry.switch.startsWith("input_select.");

            iconWrap.classList.add("switchable");
            iconWrap.setAttribute("role", isSelect ? "button" : "switch");
            iconWrap.setAttribute("tabindex", "0");
            iconWrap.setAttribute("aria-label", entry.name);

            // stopPropagation: schakelen klapt de regel niet uit
            this._onActivate(iconWrap, () => this._activateMain(entry.switch), { stopPropagation: true });
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

            extras = entry.extras.map((extra) => registry.get(extra.type).build(this, extra, HELPERS));
            extrasEl.append(...extras.flatMap((extra) => extra.els || [extra.el]));
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
          const columns = width >= 4 * MIN_COLUMN_WIDTH + 3 * COLUMN_GAP ? 4
            : width >= 2 * MIN_COLUMN_WIDTH + COLUMN_GAP ? 2
            : 1;

          // Bij een nieuw aantal kolommen worden de regels opnieuw geplaatst (en gemeten);
          // anders kan alleen de beschikbare breedte veranderd zijn
          if (columns !== this._columns) this._applyLayout(columns);
          else this._fitSummaries();
        });
        this._observer.observe(grid);

        this._update();
      }

      // Plaatst de regels in het raster, met een scheidingslijn tussen de rijen.
      // Bij 1 of 2 kolommen beslaat een uitgeklapte regel een eigen rij over de volle breedte.
      // Bij 4 kolommen beslaat hij de meest linker of de meest rechter twee kolommen ("band"):
      // de twee andere kolommen worden gevuld met de regels uit de lijst (eerst de regels die al
      // in de rij stonden, daarna de volgende), net zoveel als er naast de uitgeklapte regel passen.
      // De volgorde verandert dus alleen zolang een regel uitgeklapt is.
      _applyLayout(columns) {
        this._columns = columns;
        this._grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        this._grid.replaceChildren();
        this._bandHeights = new Map(); // uitgeklapt element -> hoogte waarmee de band is opgebouwd

        const rows = this._rows;
        const last = rows.length - 1;
        const isOpen = (index) => !!rows[index].extrasEl && this._expanded.has(index);

        const makeDivider = () => {
          const divider = document.createElement("div");
          divider.className = "divider";
          return divider;
        };

        // Rijen van `cols` kolommen in `container`: een scheidingslijn voor iedere nieuwe rij,
        // behalve de eerste. Een element dat de hele rij beslaat (span === cols) begint een nieuwe
        // rij. place() geeft een functie terug die de plaatsing ongedaan maakt.
        const makeFlow = (container, cols) => {
          let column = 0; // aantal gevulde kolommen in de huidige rij

          return {
            partial: () => column !== 0,
            place(node, span) {
              const previous = column;
              const added = [];

              if (span === cols) column = 0;

              if (column === 0 && container.childElementCount) {
                const divider = makeDivider();
                container.append(divider);
                added.push(divider);
              }

              container.append(node);
              added.push(node);
              column = span === cols ? 0 : (column + 1) % cols;

              return () => {
                added.forEach((added_node) => added_node.remove());
                column = previous;
              };
            }
          };
        };

        const put = (flow, index, span, gridColumn = "") => {
          rows[index].el.style.gridColumn = gridColumn;
          rows[index].el.style.gridRow = "";
          return flow.place(rows[index].el, span);
        };

        const mainFlow = makeFlow(this._grid, columns);

        if (columns !== 4) {
          rows.forEach((row, index) => {
            const open = isOpen(index);
            put(mainFlow, index, open ? columns : 1, open ? "1 / -1" : "");
          });

          this._observeBands();
          this._fitSummaries();
          return;
        }

        // Vier kolommen: losse regels vullen rijen van vier; een uitgeklapte regel krijgt een band
        const pending = []; // regels van de huidige (nog onvolledige) rij

        const flush = () => {
          pending.splice(0).forEach((index) => put(mainFlow, index, 1));
        };

        let i = 0;

        while (i <= last) {
          if (!isOpen(i)) {
            pending.push(i);
            i++;
            if (pending.length === 4) flush();
            continue;
          }

          // Staan er al regels in de rij, dan staat de uitgeklapte regel rechts en komen die
          // regels (en de volgende) links ernaast; anders staat hij links
          const openLeft = pending.length === 0;
          const openRow = rows[i];

          const band = document.createElement("div");
          band.className = "band";
          band.style.columnGap = `${COLUMN_GAP}px`;

          const side = document.createElement("div");
          side.className = "band-side";
          side.style.columnGap = `${COLUMN_GAP}px`;
          side.style.gridColumn = openLeft ? "3 / span 2" : "1 / span 2";
          side.style.gridRow = "1";

          openRow.el.style.gridColumn = openLeft ? "1 / span 2" : "3 / span 2";
          openRow.el.style.gridRow = "1";

          band.append(...(openLeft ? [openRow.el, side] : [side, openRow.el]));
          mainFlow.place(band, 4);

          const sideFlow = makeFlow(side, 2);

          pending.splice(0).forEach((index) => put(sideFlow, index, 1));

          // Vul de zijkant tot zijn hoogte zo dicht mogelijk bij die van de uitgeklapte regel komt
          const height = openRow.el.offsetHeight;
          this._bandHeights.set(openRow.el, height);

          let j = i + 1;

          while (j <= last && !isOpen(j)) {
            const freeCell = sideFlow.partial(); // een vrije cel in de laatste rij kost geen hoogte
            const before = side.offsetHeight;

            if (!freeCell && before >= height) break;

            const undo = put(sideFlow, j, 1);

            if (!freeCell) {
              const after = side.offsetHeight;

              if (after > height && after - height >= height - before) {
                undo();
                break;
              }
            }

            j++;
          }

          i = j;
        }

        flush();
        this._observeBands();
        this._fitSummaries();
      }

      // Past de banden opnieuw aan als een uitgeklapte regel van hoogte verandert
      // (bijvoorbeeld door een andere breedte of nieuwe inhoud)
      _observeBands() {
        if (!this._bandObserver) {
          this._bandObserver = new ResizeObserver(() => {
            if (this._columns !== 4 || this._bandRefit) return;

            const changed = [...(this._bandHeights || [])].some(
              ([element, height]) => Math.abs(element.offsetHeight - height) >= 2
            );

            if (!changed) return;

            this._bandRefit = requestAnimationFrame(() => {
              this._bandRefit = null;
              if (this._columns === 4 && !this._disposed) this._applyLayout(4);
            });
          });
        }

        this._bandObserver.disconnect();
        (this._bandHeights || new Map()).forEach((height, element) => this._bandObserver.observe(element));
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

      // Kleur die bij de huidige status van een input_select hoort (exacte status eerst,
      // daarna zonder hoofdletters/spaties); null als de status niet is geconfigureerd
      _stateColor(entry, state) {
        if (!entry.stateColors?.length || !isAvailable(state)) return null;

        const exact = entry.stateColors.find((item) => item.state === state.state);

        if (exact) return exact.color;

        const normalize = (value) => value.trim().toLowerCase();
        const loose = entry.stateColors.find((item) => normalize(item.state) === normalize(state.state));

        return loose ? loose.color : null;
      }

      // Klik op het hoofdicoon: een input_select gaat naar de volgende optie
      // (input_select.select_next, daarna weer de eerste); alles anders wordt aan/uit gezet
      _activateMain(entityId) {
        if (!entityId.startsWith("input_select.")) {
          this._toggle(entityId);
          return;
        }

        const state = this._getState(entityId);

        if (!this._hass || !state || state.state === "unavailable") return;

        this._callService("input_select", "select_next", { entity_id: entityId, cycle: true });
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

      // ----- Bijwerken -----

      _formatValue(entityId, decimals, fallbackUnit) {
        const value = this._getNumber(entityId);

        if (value === null) return NO_VALUE;

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

      // Willekeurige entiteit als tekst, met de eenheid van de entiteit zelf. Numerieke waarden
      // volgen de weergavenauwkeurigheid van Home Assistant; andere waarden tonen hun (vertaalde) status.
      _formatEntity(entityId) {
        const state = this._getState(entityId);

        if (!state || state.state === "unavailable" || state.state === "unknown") return NO_VALUE;

        if (this._hass?.formatEntityState) return this._hass.formatEntityState(state);

        const value = toNumber(state.state);

        if (value === null) return state.state;

        let text;

        try {
          text = value.toLocaleString(this._language, { maximumFractionDigits: 2 });
        } catch (err) {
          text = String(value);
        }

        const unit = state.attributes?.unit_of_measurement;

        return unit ? `${text} ${unit}` : text;
      }

      _update() {
        if (!this._hass || !this._rows) return;

        let summaryChanged = false;
        this._rows.forEach(({ entry, iconWrap, values, extras, badges }) => {
          if (entry.switch) {
            const state = this._getState(entry.switch);
            const isSelect = entry.switch.startsWith("input_select.");

            iconWrap.classList.toggle("unavailable", !state || state.state === "unavailable");

            if (isSelect) {
              // Een input_select is een knop: geen aan/uit-status (ook niet bij een optie "on"),
              // maar een kleur per status
              const color = this._stateColor(entry, state);

              iconWrap.classList.toggle("has-state-color", !!color);

              if (color) iconWrap.style.setProperty("--cc-state-color", color);
              else iconWrap.style.removeProperty("--cc-state-color");
            } else {
              const isOn = state?.state === "on";

              iconWrap.classList.toggle("on", isOn);
              iconWrap.setAttribute("aria-checked", String(isOn));
            }
          }

          // Getoonde badges krijgen op volgorde een hoek: eerst rechtsboven, dan rechtsonder
          let shown = 0;

          badges.forEach(({ def, el, icon }) => {
            const result = shown < BADGE_SLOTS.length ? def.resolve(this, entry) : null;

            el.hidden = !result;
            if (!result) return;

            if (icon.icon !== result.icon) icon.icon = result.icon;
            el.dataset.tone = result.tone;
            if (result.color) el.style.setProperty("--cc-badge-color", result.color);
            else el.style.removeProperty("--cc-badge-color");
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
      description: "Rows with sensors, switches and media, climate and power controls.",
      editor: {
        schema: [
          { name: "entries", selector: { object: {} } },
          { name: "css_url", selector: { text: {} } }
        ]
      },
      stubConfig: {
        entries: [{ name: "Living room", icon: "mdi:sofa" }] // vervangen door card.rows.default_name
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
